import Redis from 'ioredis';
import { ConfigService } from '../config/config.service';

export const redisProviders = [
  {
    provide: Redis,
    useFactory: async (config: ConfigService) => {
      return new Redis(config.getRedisUrl(), { lazyConnect: true });
    },
    inject: [ConfigService],
  }
];
