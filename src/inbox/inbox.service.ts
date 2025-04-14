import { Inject, Injectable } from '@nestjs/common';
import { ConfigService } from '../common/config/config.service';
import { Binary, buildAddress, getNetwork, Message } from '@ltonetwork/lto';
import { LoggerService } from '../common/logger/logger.service';
import Redis from 'ioredis';
import { MessageSummary } from './inbox.dto';
import { Bucket } from 'any-bucket';
import * as crypto from 'crypto';
import { TelegramService } from 'src/common/telegram/telegram.service';

export interface PaginationOptions {
  limit?: number;
  offset?: number;
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

  async list(recipient: string, options?: Omit<PaginationOptions, 'meta'>): Promise<PaginatedResult<MessageSummary>> {
    const type = options?.type;
    const limit = options?.limit;
    const offset = options?.offset;

    const allKeys = await this.redis.hkeys(`inbox:${recipient}`);
    const total = allKeys.length;

    let keysToFetch = allKeys;

    if (typeof limit === 'number' && typeof offset === 'number') {
      keysToFetch = allKeys.slice(offset, offset + limit);
    }

    const items = await Promise.all(
      keysToFetch.map(async (hash) => {
        const raw = await this.redis.hget(`inbox:${recipient}`, hash);
        const parsed = JSON.parse(raw);

        const { data, encryptedData, ...messageMetadata } = parsed;
        messageMetadata.meta = messageMetadata.meta || {};

        if (messageMetadata.thumbnail === true) {
          try {
            const thumbnail = await this.loadThumbnail(parsed.hash);
            if (thumbnail) {
              messageMetadata.meta.thumbnail = thumbnail;
            }
          } catch {
            this.logger.warn(`Thumbnail for '${parsed.hash}' not found or failed to load`);
          }
        }

        delete messageMetadata.thumbnail;

        return messageMetadata as MessageSummary;
      }),
    );

    const filteredItems = type ? items.filter((item) => item.type === type) : items;

    return {
      items: filteredItems,
      total,
      hasMore: typeof limit === 'number' && typeof offset === 'number' ? offset + limit < total : false,
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

      //workaround 'file-type'
      const { fileTypeFromBuffer } = await import('file-type');
      const type = await fileTypeFromBuffer(thumbnailBuffer as Uint8Array);
      const mime = type?.mime || 'application/octet-stream';
      const base64 = thumbnailBuffer.toString('base64');
      return `data:${mime};base64,${base64}`;
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
}
