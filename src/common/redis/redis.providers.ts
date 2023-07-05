import Redis from 'ioredis';
import { ConfigService } from '../config/config.service';

export const redisProviders = [
  {
    provide: Redis,
    useFactory: async (config: ConfigService) => {
      const redis = new Redis(config.getRedisUrl());
      await redis.connect();
      return redis;
    },
    inject: [ConfigService],
  }
];
