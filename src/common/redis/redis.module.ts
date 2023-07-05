import { Inject, Module, OnModuleDestroy } from '@nestjs/common';
import { ConfigModule } from '../config/config.module';
import { redisProviders } from './redis.providers';
import Redis from 'ioredis';

@Module({
  providers: [...redisProviders],
  imports: [ConfigModule],
})
export class RedisModule implements OnModuleDestroy {
  private readonly redis: Redis;

  constructor(@Inject(Redis) redis: Redis) {
    this.redis = redis;
  }

  async onModuleDestroy() {
    await this.redis.disconnect();
  }
}
