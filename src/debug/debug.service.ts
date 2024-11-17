import { Injectable } from '@nestjs/common';
import Redis from 'ioredis';
import { Message } from '@ltonetwork/lto';

@Injectable()
export class DebugService {
  constructor(private redis: Redis) {}

  async get(recipient: string, hash: string): Promise<Message> {
    const data = await this.redis.hget(`inbox:${recipient}`, hash);
    if (!data) throw new Error(`message not found`);

    const message = JSON.parse(data);
    delete message.data;
    delete message.signature;

    return message;
  }

  async has(recipient: string, hash: string): Promise<boolean> {
    return !!(await this.redis.hexists(`inbox:${recipient}`, hash));
  }

  async getMessageCount(recipient: string): Promise<number> {
    return await this.redis.hlen(`inbox:${recipient}`);
  }

  async getMessageHashes(recipient: string): Promise<string[]> {
    console.log(`add ${recipient}`);
    const keys = await this.redis.hkeys(`inbox:${recipient}`);
    return keys;
  }
}
