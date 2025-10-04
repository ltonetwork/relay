import { Inject, Injectable } from '@nestjs/common';
import { ConfigService } from '../common/config/config.service';
import { Message } from 'eqty-core';
import { LoggerService } from '../common/logger/logger.service';
import Redis from 'ioredis';
import { MessageSummery } from './inbox.dto';
import { Bucket } from 'any-bucket';

@Injectable()
export class InboxService {
  constructor(
    private config: ConfigService,
    private redis: Redis,
    @Inject('INBOX_BUCKET') private bucket: Bucket,
    private logger: LoggerService,
  ) {}

  async list(recipient: string, type?: string): Promise<MessageSummery[]> {
    const data = await this.redis.hgetall(`inbox:${recipient}`);

    const messages: MessageSummery[] = Object.values(data)
      .map((item: string) => JSON.parse(item))
      .map((message: any) => ({
        hash: message.hash,
        type: message.type,
        timestamp: message.timestamp,
        sender: message.sender,
        recipient: message.recipient,
        size: message.size,
      }));

    return type ? messages.filter((message: MessageSummery) => message.type === type) : messages;
  }

  async has(recipient: string, hash: string): Promise<boolean> {
    return !!(await this.redis.hexists(`inbox:${recipient}`, hash));
  }

  async get(recipient: string, hash: string): Promise<Message> {
    const data = await this.redis.hget(`inbox:${recipient}`, hash);
    if (!data) throw new Error(`message not found`);

    const message = JSON.parse(data);

    return 'data' in message || 'encryptedData' in message
      ? this.createFromEmbedded(message)
      : await this.loadFromFile(hash);
  }

  private createFromEmbedded(data: any): Message {
    if (!data.sender) {
      throw new Error('Invalid message data: sender is missing');
    }
    return Message.from(data);
  }

  private async loadFromFile(hash: string): Promise<Message> {
    const data = await this.bucket.get(hash);
    return Message.from(data);
  }

  async store(message: Message): Promise<void> {
    if (await this.has(message.recipient, message.hash.base58)) {
      this.logger.debug(`storage: message '${message.hash.base58}' already stored`);
      return;
    }

    if (!this.config.isInboxEnabled()) throw new Error(`storage: module not enabled`);
    this.logger.debug(`storage: storing message '${message.hash.base58}'`);

    const embed = message.data.length <= this.config.getStorageEmbedMaxSize();

    const promises: Promise<any>[] = [];
    promises.push(this.storeIndex(message, embed));
    if (!embed) promises.push(this.storeFile(message));

    await Promise.all(promises);
  }

  private async storeIndex(message: Message, embed: boolean): Promise<void> {
    const data: any = message.toJSON();

    data.size = message.data.length;
    data.sender = message.sender;
    data.recipient = message.recipient;

    if (!embed) {
      delete data.encryptedData;
      delete data.data;
    }

    await this.redis.hset(`inbox:${message.recipient}`, message.hash.base58, JSON.stringify(data));
  }

  private async storeFile(message: Message): Promise<void> {
    await this.bucket.put(message.hash.base58, message.toBinary());
  }

  async delete(recipient: string, hash: string): Promise<void> {
    const exists = await this.has(recipient, hash);
    if (!exists) {
      this.logger.warn(`delete: message '${hash}' not found for recipient '${recipient}'`);
      throw new Error(`Message not found`);
    }

    await this.redis.hdel(`inbox:${recipient}`, hash);
    this.logger.debug(`delete: message '${hash}' deleted from Redis for recipient '${recipient}'`);

    try {
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
}
