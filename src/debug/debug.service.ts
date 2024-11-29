import { Injectable } from '@nestjs/common';
import Redis from 'ioredis';
import * as crypto from 'crypto';
import { TelegramService } from '../common/telegram/telegram.service';

@Injectable()
export class DebugService {
  constructor(private readonly redis: Redis, private readonly telegramService: TelegramService) {}

  async hasMessage(recipient: string, hash: string): Promise<boolean> {
    return !!(await this.redis.hexists(`inbox:${recipient}`, hash));
  }

  async deleteMessage(recipient: string, hash: string): Promise<void> {
    const exists = await this.hasMessage(recipient, hash);
    if (!exists) {
      throw new Error('Message not found');
    }

    await this.redis.hdel(`inbox:${recipient}`, hash);
  }

  async generateValidationCode(): Promise<void> {
    const code = crypto.randomBytes(4).toString('hex');
    await this.redis.set('debug:validationCode', code, 'EX', 3600);

    await this.telegramService.sendMessage(`Code: ${code}`);
  }

  async getValidationCode(): Promise<string | null> {
    return await this.redis.get('debug:validationCode');
  }

  async isValidCode(code: string): Promise<boolean> {
    const validCode = await this.getValidationCode();
    return validCode === code;
  }
}
