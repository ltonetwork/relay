import { Inject, Injectable } from '@nestjs/common';
import { ConfigService } from '../common/config/config.service';
let Message: any;
let Binary: any;
import { LoggerService } from '../common/logger/logger.service';
import Redis from 'ioredis';
import { MessageSummary } from './inbox.dto';
import { Bucket } from 'any-bucket';

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
  private initialized = false;

  constructor(
    private config: ConfigService,
    private redis: Redis,
    @Inject('INBOX_BUCKET') private bucket: Bucket,
    @Inject('INBOX_THUMBNAIL_BUCKET') private thumbnail_bucket: Bucket,
    private logger: LoggerService,
  ) {}

  private async ensureInitialized(): Promise<void> {
    if (this.initialized) return;

    if (process.env.NODE_ENV === 'test') {
      try {
        const eqtyCore = await import('eqty-core');
        Message = eqtyCore.Message;
        Binary = eqtyCore.Binary;
      } catch {
        Message = Message || {
          from: (data: any) => ({ ...data }),
        };
        Binary = Binary || {
          fromBase58: (_s: string) => ({ base58: _s }),
        };
      }
      this.initialized = true;
      return;
    }

    const importFn = new Function('specifier', 'return import(specifier)');
    const eqtyCore = await importFn('eqty-core');
    Message = eqtyCore.Message;
    Binary = eqtyCore.Binary;
    this.initialized = true;
  }

  async list(recipient: string, options?: PaginationOptions): Promise<PaginatedResult<MessageSummary>> {
    const type = options?.type;
    const limit = options?.limit;
    const offset = options?.offset;

    const allKeys = await this.redis.hkeys(`inbox:${recipient.toLowerCase()}`);
    const total = allKeys.length;

    let keysToFetch = allKeys;

    if (typeof limit === 'number' && typeof offset === 'number') {
      const validLimit = Math.max(1, Math.min(100, limit));
      const validOffset = Math.max(0, offset);
      keysToFetch = allKeys.slice(validOffset, validOffset + validLimit);
    }

    const items = await Promise.all(
      keysToFetch.map(async (hash) => {
        const raw = await this.redis.hget(`inbox:${recipient.toLowerCase()}`, hash);
        if (!raw) {
          this.logger.warn(`list: message '${hash}' found in keys but no data in Redis`);
          return null;
        }

        let parsed;
        try {
          parsed = JSON.parse(raw);
        } catch (error) {
          this.logger.error(`list: failed to parse message '${hash}' JSON`, error);
          return null;
        }

        const { data: _data, encryptedData: _encryptedData, ...messageMetadata } = parsed;
        messageMetadata.meta = messageMetadata.meta || {};

        if (messageMetadata.thumbnail === true) {
          const thumbnail = await this.loadThumbnail(parsed.hash);
          if (thumbnail) {
            messageMetadata.meta.thumbnail = thumbnail;
          }
        }

        delete messageMetadata.thumbnail;

        return messageMetadata as MessageSummary;
      }),
    );

    const validItems = items.filter((item): item is MessageSummary => item !== null);

    const filteredItems = type ? validItems.filter((item) => item.type === type) : validItems;

    return {
      items: filteredItems,
      total,
      hasMore: typeof limit === 'number' && typeof offset === 'number' ? offset + limit < total : false,
    };
  }

  async has(recipient: string, hash: string): Promise<boolean> {
    return !!(await this.redis.hexists(`inbox:${recipient.toLowerCase()}`, hash));
  }

  async get(recipient: string, hash: string): Promise<any> {
    await this.ensureInitialized();

    const data = await this.redis.hget(`inbox:${recipient.toLowerCase()}`, hash);

    if (!data) throw new Error(`message not found`);

    try {
      const messageMetadata = JSON.parse(data);

      if (messageMetadata.thumbnail === true) {
        messageMetadata.meta.thumbnail = await this.loadThumbnail(hash);
      }

      if ('data' in messageMetadata || 'encryptedData' in messageMetadata) {
        return this.createFromEmbedded(messageMetadata);
      } else {
        return await this.reconstructFromBucket(messageMetadata, hash);
      }
    } catch (error) {
      this.logger.error(`Failed to parse message JSON for ${recipient}`, error);
      throw new Error(`Invalid message format`);
    }
  }

  private createFromEmbedded(data: any): any {
    if (!data.sender) {
      throw new Error('Invalid message data: sender is missing');
    }
    return Message.from(data);
  }

  private async reconstructFromBucket(metadata: any, hash: string): Promise<any> {
    try {
      const fileData = await this.bucket.get(hash);
      if (!fileData) {
        throw new Error(`File data not found in bucket for hash '${hash}'`);
      }

      const binaryData = fileData instanceof Uint8Array ? fileData : new Uint8Array(fileData);

      const message = new Message(binaryData, metadata.mediaType, metadata.meta);
      message.version = metadata.version;
      message.timestamp = metadata.timestamp;
      message.sender = metadata.sender;
      message.recipient = metadata.recipient;
      message.signature = metadata.signature ? Binary.fromBase58(metadata.signature) : undefined;
      message._hash = Binary.fromBase58(metadata.hash);

      return message;
    } catch (error) {
      const errorCode = (error as any).code;
      if (errorCode === 'NoSuchKey' || errorCode === 'ENOENT') {
        this.logger.error(`reconstructFromBucket: file '${hash}' not found in bucket storage`);
        throw new Error(`Message file not found in storage`);
      }
      this.logger.error(`reconstructFromBucket: failed to reconstruct message '${hash}'`, error);
      throw error;
    }
  }

  private async loadThumbnail(hash: string): Promise<string | undefined> {
    try {
      const thumbnailBuffer = await this.thumbnail_bucket.get(hash);

      const { fileTypeFromBuffer } = await import('file-type');
      const type = await fileTypeFromBuffer(thumbnailBuffer as Uint8Array);
      const mime = type?.mime || 'application/octet-stream';
      const base64 = thumbnailBuffer.toString('base64');
      return `data:${mime};base64,${base64}`;
    } catch (error) {
      const errorCode = (error as any).code;
      if (errorCode === 'NoSuchKey' || errorCode === 'ENOENT') {
        this.logger.warn(`Thumbnail file '${hash}' not found in bucket storage`);
      } else {
        this.logger.error(`Failed to load thumbnail '${hash}' from bucket`, error);
      }
      return undefined;
    }
  }

  async store(message: any): Promise<void> {
    await this.ensureInitialized();

    if (await this.has(message.recipient, message.hash.base58)) {
      this.logger.debug(`storage: message '${message.hash.base58}' already stored`);
      return;
    }

    if (!this.config.isInboxEnabled()) throw new Error(`storage: module not enabled`);
    this.logger.debug(`storage: storing message '${message.hash.base58}'`);

    const maxEmbedSize = this.config.getStorageEmbedMaxSize();
    if (!message.data || (!Array.isArray(message.data) && !(message.data instanceof Uint8Array))) {
      throw new Error('Invalid message data: data is missing or invalid');
    }
    const messageSize = message.data.length;
    const thumbnailSize = message.meta?.thumbnail ? message.meta.thumbnail.length : 0;

    const embed = messageSize + thumbnailSize <= maxEmbedSize;
    const promises: Promise<any>[] = [];

    promises.push(this.storeIndex(message, embed));
    if (!embed) promises.push(this.storeFile(message));

    promises.push(this.updateLastModified(message.recipient));

    await Promise.all(promises);
  }

  private async storeIndex(message: any, embed: boolean): Promise<void> {
    const data: any = embed
      ? message.toJSON()
      : {
          version: message.version,
          meta: message.meta,
          mediaType: message.mediaType,
          timestamp: message.timestamp,
          sender: message.sender,
          recipient: message.recipient,
          signature: message.signature?.base58,
          hash: message.hash.base58,
        };

    data.size = message.data.length;
    data.sender = message.sender;
    data.recipient = message.recipient;

    if (message.meta?.thumbnail) {
      data.thumbnail = true;
    }

    if (!embed) {
      delete data.data;
      delete data.meta?.thumbnail;
    }

    await this.redis.hset(`inbox:${message.recipient.toLowerCase()}`, message.hash.base58, JSON.stringify(data));
  }

  private async storeFile(message: any): Promise<void> {
    if (message.meta?.thumbnail) {
      const thumbnail = new Uint8Array(Buffer.from(message.meta.thumbnail, 'base64'));
      await this.thumbnail_bucket.put(message.hash.base58, thumbnail);
    }
    await this.bucket.put(message.hash.base58, message.data);
  }

  async delete(recipient: string, hash: string): Promise<void> {
    const exists = await this.has(recipient, hash);
    if (!exists) {
      this.logger.warn(`delete: message '${hash}' not found for recipient '${recipient}'`);
      throw new Error(`Message not found`);
    }

    const data = await this.redis.hget(`inbox:${recipient.toLowerCase()}`, hash);
    let parsed = null;
    if (data) {
      try {
        parsed = JSON.parse(data);
      } catch (error) {
        this.logger.error(`delete: failed to parse message metadata for '${hash}'`, error);
      }
    }

    const hasThumbnailFile = parsed?.thumbnail === true;

    await this.redis.hdel(`inbox:${recipient.toLowerCase()}`, hash);
    this.logger.debug(`delete: message '${hash}' deleted from Redis for recipient '${recipient}'`);
    await this.updateLastModified(recipient);

    const deletePromises: Promise<any>[] = [];

    deletePromises.push(
      Promise.resolve(this.bucket.delete(hash)).catch((error) => {
        const errorCode = (error as any).code;
        if (errorCode === 'NoSuchKey' || errorCode === 'ENOENT') {
          this.logger.warn(`delete: file '${hash}' not found in bucket storage`);
        } else {
          this.logger.error(`delete: failed to delete main file '${hash}' from bucket storage`, error);
          throw error;
        }
      }),
    );

    if (hasThumbnailFile) {
      deletePromises.push(
        Promise.resolve(this.thumbnail_bucket.delete(hash)).catch((error) => {
          const errorCode = (error as any).code;
          if (errorCode === 'NoSuchKey' || errorCode === 'ENOENT') {
            this.logger.debug(`delete: thumbnail '${hash}' not found in thumbnail bucket (already deleted)`);
          } else {
            this.logger.error(`delete: failed to delete thumbnail '${hash}' from thumbnail bucket`, error);
            throw error;
          }
        }),
      );
    }

    await Promise.all(deletePromises);
    this.logger.debug(`delete: all files for '${hash}' deleted from bucket storage`);
  }

  async getLastModified(recipient: string): Promise<Date> {
    const lastModified = await this.redis.get(`inbox:${recipient.toLowerCase()}:lastModified`);

    if (!lastModified) {
      return new Date(0);
    }

    const date = new Date(lastModified);
    if (isNaN(date.getTime())) {
      this.logger.warn(`Invalid timestamp for inbox:${recipient}:lastModified`, { lastModified });
      return new Date(0);
    }

    date.setMilliseconds(0);
    return date;
  }

  async updateLastModified(recipient: string): Promise<void> {
    const now = new Date();
    now.setMilliseconds(0);
    await this.redis.set(`inbox:${recipient.toLowerCase()}:lastModified`, now.toISOString(), 'EX', 86400000);
  }
}
