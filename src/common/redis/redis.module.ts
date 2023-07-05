import { Module } from '@nestjs/common';
import { ConfigModule } from '../config/config.module';
import { redisProviders } from './redis.providers';

@Module({
  providers: [...redisProviders],
  imports: [ConfigModule],
})
export class RedisModule {}
