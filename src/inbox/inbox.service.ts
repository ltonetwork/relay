import { Inject, Injectable } from '@nestjs/common';
import { ConfigService } from '../common/config/config.service';
// Dynamic import for eqty-core ES module
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
      keysToFetch = allKeys.slice(offset, offset + limit);
    }

    const items = await Promise.all(
      keysToFetch.map(async (hash) => {
        const raw = await this.redis.hget(`inbox:${recipient.toLowerCase()}`, hash);
        const parsed = JSON.parse(raw);

        const { data: _data, encryptedData: _encryptedData, ...messageMetadata } = parsed;
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
    return !!(await this.redis.hexists(`inbox:${recipient.toLowerCase()}`, hash));
  }

  async get(recipient: string, hash: string): Promise<any> {
    await this.ensureInitialized();

    const data = await this.redis.hget(`inbox:${recipient.toLowerCase()}`, hash);

    if (!data) throw new Error(`message not found`);

    try {
      const messageMetadata = JSON.parse(data);

      if (messageMetadata.thumbnail) {
        try {
          messageMetadata.meta.thumbnail = await this.loadThumbnail(hash);
        } catch (e) {
          this.logger.warn(`Thumbnail for '${hash}' not found`);
        }
      }

      // If message has embedded data, use it directly
      if ('data' in messageMetadata || 'encryptedData' in messageMetadata) {
        return this.createFromEmbedded(messageMetadata);
      } else {
        // For large files, reconstruct message from metadata + bucket data
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
    // Get the file data from bucket
    const fileData = await this.bucket.get(hash);
    const binaryData = fileData instanceof Uint8Array ? fileData : new Uint8Array(fileData);

    // Reconstruct the message from metadata + file data
    const message = new Message(binaryData, metadata.mediaType, metadata.meta);
    message.version = metadata.version;
    message.timestamp = metadata.timestamp;
    message.sender = metadata.sender;
    message.recipient = metadata.recipient;
    message.signature = metadata.signature ? Binary.fromBase58(metadata.signature) : undefined;
    message._hash = Binary.fromBase58(metadata.hash);

    return message;
  }

  private async loadThumbnail(hash: string): Promise<string | undefined> {
    try {
      const thumbnailBuffer = await this.thumbnail_bucket.get(hash);

      // Dynamic import for file type detection
      const { fileTypeFromBuffer } = await import('file-type');
      const type = await fileTypeFromBuffer(thumbnailBuffer as Uint8Array);
      const mime = type?.mime || 'application/octet-stream';
      const base64 = thumbnailBuffer.toString('base64');
      return `data:${mime};base64,${base64}`;
    } catch (error) {
      if ((error as any).code === 'NoSuchKey') {
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
    const messageSize = message.data.length;
    const thumbnailSize = message.meta?.thumbnail ? message.meta.thumbnail.length : 0;

    const embed = messageSize + thumbnailSize <= maxEmbedSize;
    const promises: Promise<any>[] = [];

    promises.push(this.storeIndex(message, embed));
    if (!embed) promises.push(this.storeFile(message));

    // Update the Last-Modified timestamp
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
    // Store only the file data, not the entire message structure
    await this.bucket.put(message.hash.base58, message.data);
  }

  async delete(recipient: string, hash: string): Promise<void> {
    const exists = await this.has(recipient, hash);
    if (!exists) {
      this.logger.warn(`delete: message '${hash}' not found for recipient '${recipient}'`);
      throw new Error(`Message not found`);
    }

    const data = await this.redis.hget(`inbox:${recipient.toLowerCase()}`, hash);

    const parsed = data && JSON.parse(data);
    const hasThumbnail = parsed?.meta?.thumbnail !== undefined;

    await this.redis.hdel(`inbox:${recipient.toLowerCase()}`, hash);
    this.logger.debug(`delete: message '${hash}' deleted from Redis for recipient '${recipient}'`);
    await this.updateLastModified(recipient);

    try {
      if (hasThumbnail) {
        await this.thumbnail_bucket.delete(hash);
      }

      await this.bucket.delete(hash);
      this.logger.debug(`delete: file '${hash}' deleted from bucket storage`);
    } catch (error) {
      if ((error as any).code === 'NoSuchKey') {
        this.logger.warn(`delete: file '${hash}' not found in bucket storage`);
      } else {
        this.logger.error(`delete: failed to delete file '${hash}' from bucket storage`, error);
      }
    }
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
