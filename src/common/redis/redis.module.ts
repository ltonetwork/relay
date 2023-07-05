import { Inject, Module, OnModuleDestroy, OnModuleInit } from '@nestjs/common';
import { ConfigModule } from '../config/config.module';
import { redisProviders } from './redis.providers';
import Redis from 'ioredis';
import { ConfigService } from '../config/config.service';

@Module({
  providers: [...redisProviders],
  imports: [ConfigModule],
  exports: [Redis],
})
export class RedisModule implements OnModuleInit, OnModuleDestroy {
  constructor(@Inject(Redis) private readonly redis: Redis, private readonly config: ConfigService) {}

  private shouldStart(): boolean {
    return this.config.isInboxEnabled();
  }

  async onModuleInit() {
    if (this.shouldStart()) {
      await this.redis.connect();
    }
  }

  async onModuleDestroy() {
    await this.redis.disconnect();
  }
}
