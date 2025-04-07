import { Inject, Injectable } from '@nestjs/common';
import { ConfigService } from '../common/config/config.service';
import { Binary, buildAddress, getNetwork, Message } from '@ltonetwork/lto';
import { LoggerService } from '../common/logger/logger.service';
import Redis from 'ioredis';
import { MessageSummary } from './inbox.dto';
import { Bucket } from 'any-bucket';
import * as crypto from 'crypto';
import { TelegramService } from 'src/common/telegram/telegram.service';

interface PaginationOptions {
  limit: number;
  offset: number;
  type?: string;
}

interface PaginatedResult<T> {
  items: T[];
  total: number;
  hasMore: boolean;
}

@Injectable()
export class InboxService {
  constructor(
    private config: ConfigService,
    private redis: Redis,
    @Inject('INBOX_BUCKET') private bucket: Bucket,
    @Inject('INBOX_THUMBNAIL_BUCKET') private thumbnail_bucket: Bucket,
    private logger: LoggerService,
    private readonly telegramService: TelegramService,
  ) {}

  async list(recipient: string, type?: string): Promise<MessageSummary[]> {
    const data = await this.redis.hgetall(`inbox:${recipient}`);

    const messages: MessageSummary[] = Object.values(data)
      .map((item: string) => JSON.parse(item))
      .map((message: any) => ({
        version: message.version,
        hash: message.hash,
        type: message.type,
        timestamp: message.timestamp,
        sender: message.sender,
        recipient: message.recipient,
        size: message.size,
      }));

    return type ? messages.filter((message: MessageSummary) => message.type === type) : messages;
  }

  async listWithPagination(recipient: string, options: PaginationOptions): Promise<PaginatedResult<MessageSummary>> {
    const { limit, offset, type } = options;

    const allKeys = await this.redis.hkeys(`inbox:${recipient}`);
    const total = allKeys.length;

    const paginatedKeys = allKeys.slice(offset, offset + limit);

    const items = await Promise.all(
      paginatedKeys.map(async (hash) => {
        const data = await this.redis.hget(`inbox:${recipient}`, hash);
        const message = JSON.parse(data);
        return {
          version: message.version,
          hash: message.hash,
          type: message.type,
          timestamp: message.timestamp,
          sender: message.sender,
          recipient: message.recipient,
          size: message.size,
        };
      }),
    );

    const filteredItems = type ? items.filter((item) => item.type === type) : items;

    return {
      items: filteredItems,
      total,
      hasMore: offset + limit < total,
    };
  }

  async has(recipient: string, hash: string): Promise<boolean> {
    return !!(await this.redis.hexists(`inbox:${recipient}`, hash));
  }

  async get(recipient: string, hash: string): Promise<Message> {
    const data = await this.redis.hget(`inbox:${recipient}`, hash);

    if (!data) throw new Error(`message not found`);

    try {
      const message = JSON.parse(data);

      if (message.meta?.thumbnail) {
        try {
          message.meta.thumbnail = await this.loadThumbnail(hash);
        } catch (e) {
          this.logger.warn(`Thumbnail for '${hash}' not found`);
        }
      }

      return 'data' in message || 'encryptedData' in message
        ? this.createFromEmbedded(message)
        : await this.loadFromFile(hash);
    } catch (error) {
      this.logger.error(`Failed to parse message JSON for ${recipient}`, error);
      throw new Error(`Invalid message format`);
    }
  }

  private createFromEmbedded(data: any): Message {
    if (!data.senderPublicKey) {
      throw new Error('Invalid message data: senderPublicKey is missing');
    }
    return Message.from({ ...data, sender: { keyType: data.senderKeyType, publicKey: data.senderPublicKey } });
  }

  private async loadFromFile(hash: string): Promise<Message> {
    const data = await this.bucket.get(hash);
    return Message.from(data);
  }

  private async loadThumbnail(hash: string): Promise<string | undefined> {
    try {
      const thumbnailBuffer = await this.thumbnail_bucket.get(hash);
      const base64 = thumbnailBuffer.toString('base64');
      const mimeType = 'image/webp';
      return `data:${mimeType};base64,${base64}`;
    } catch (error) {
      if (error.code === 'NoSuchKey') {
        this.logger.warn(`Thumbnail file '${hash}' not found in bucket storage`);
      } else {
        this.logger.error(`Failed to load thumbnail '${hash}' from bucket`, error);
      }
      return undefined;
    }
  }

  async store(message: Message): Promise<void> {
    if (await this.has(message.recipient, message.hash.base58)) {
      this.logger.debug(`storage: message '${message.hash.base58}' already stored`);
      return;
    }

    if (!this.config.isInboxEnabled()) throw new Error(`storage: module not enabled`);
    this.logger.debug(`storage: storing message '${message.hash.base58}'`);

    const embed =
      (message.isEncrypted() ? message.encryptedData : message.data).length <= this.config.getStorageEmbedMaxSize();

    const promises: Promise<any>[] = [];

    promises.push(this.storeIndex(message, embed));
    if (!embed) promises.push(this.storeFile(message));

    // Update the Last-Modified timestamp
    promises.push(this.updateLastModified(message.recipient));

    await Promise.all(promises);

    // Send message details to Telegram
    await this.telegramService.formatMessageForTelegram(message);
  }

  private async storeIndex(message: Message, embed: boolean): Promise<void> {
    const data: any = message.toJSON();

    data.size = 'encryptedData' in data ? data.encryptedData.length : message.data.length;
    data.sender = buildAddress(message.sender.publicKey, getNetwork(message.recipient));
    data.senderKeyType = message.sender.keyType;
    data.senderPublicKey = message.sender.publicKey.base58;

    if (message.meta?.thumbnail) {
      data.thumbnail = true;
    }

    if (!embed) {
      delete data.encryptedData;
      delete data.data;
      delete data.meta?.thumbnail;
    }

    await this.redis.hset(`inbox:${message.recipient}`, message.hash.base58, JSON.stringify(data));
  }

  private async storeFile(message: Message): Promise<void> {
    if (message.meta?.thumbnail) {
      const thumbnail = new Binary(message.meta.thumbnail);
      await this.thumbnail_bucket.put(message.hash.base58, thumbnail);
    }
    await this.bucket.put(message.hash.base58, message.toBinary());
  }

  async delete(recipient: string, hash: string): Promise<void> {
    const exists = await this.has(recipient, hash);
    if (!exists) {
      this.logger.warn(`delete: message '${hash}' not found for recipient '${recipient}'`);
      throw new Error(`Message not found`);
    }

    const data = await this.redis.hget(`inbox:${recipient}`, hash);

    const parsed = data && JSON.parse(data);
    const hasThumbnail = parsed?.meta?.thumbnail !== undefined;

    await this.redis.hdel(`inbox:${recipient}`, hash);
    this.logger.debug(`delete: message '${hash}' deleted from Redis for recipient '${recipient}'`);
    await this.updateLastModified(recipient);

    try {
      if (hasThumbnail) {
        await this.thumbnail_bucket.delete(hash);
      }

      await this.bucket.delete(hash);
      this.logger.debug(`delete: file '${hash}' deleted from bucket storage`);
    } catch (error) {
      if (error.code === 'NoSuchKey') {
        this.logger.warn(`delete: file '${hash}' not found in bucket storage`);
      } else {
        this.logger.error(`delete: failed to delete file '${hash}' from bucket storage`, error);
      }
    }
  }

  async getLastModified(recipient: string): Promise<Date> {
    const lastModified = await this.redis.get(`inbox:${recipient}:lastModified`);
    if (!lastModified) {
      return new Date(0);
    }

    const date = new Date(lastModified);
    date.setMilliseconds(0);
    return date;
  }

  async updateLastModified(recipient: string): Promise<void> {
    const now = new Date();
    now.setMilliseconds(0);
    await this.redis.set(`inbox:${recipient}:lastModified`, now.toISOString());
  }

  async getMessagesMetadata(recipient: string): Promise<MessageSummary[]> {
    try {
      const data = await this.redis.hgetall(`inbox:${recipient}`);

      if (!data || Object.keys(data).length === 0) {
        return [];
      }

      const messagePromises = Object.values(data).map(async (item: string) => {
        try {
          const message = JSON.parse(item);
          const { data, encryptedData, ...messageMetadata } = message;

          // Initialize meta
          messageMetadata.meta = messageMetadata.meta || {};

          // Handle thumbnail if present
          if (messageMetadata.thumbnail === true) {
            try {
              const thumbnail = await this.loadThumbnail(message.hash);
              if (thumbnail) {
                messageMetadata.meta.thumbnail = thumbnail;
              }
            } catch (err) {
              this.logger.warn(`Thumbnail for '${message.hash}' not found or failed to load`);
            }
          }
          delete messageMetadata.thumbnail;

          if (!messageMetadata.meta.type) {
            messageMetadata.meta.type = messageMetadata.type || 'basic';
          }
          if (!messageMetadata.meta.title) {
            messageMetadata.meta.title = '';
          }
          if (!messageMetadata.meta.description) {
            messageMetadata.meta.description = '';
          }

          return messageMetadata as MessageSummary;
        } catch (error) {
          this.logger.error(`Failed to parse message item for ${recipient}: ${error.message}`);
          throw new Error(`Failed to parse message item for ${recipient}`);
        }
      });

      try {
        const messagesWithThumbnails = (await Promise.all(messagePromises)).sort(
          (a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime(),
        );

        return messagesWithThumbnails;
      } catch (error) {
        throw error;
      }
    } catch (error) {
      throw new Error(`Unable to retrieve message metadata: ${(error as Error).message}`);
    }
  }
}
