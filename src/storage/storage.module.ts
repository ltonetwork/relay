import { Module } from '@nestjs/common';
import { StorageService } from './storage.service';
import { storageProviders } from './storage.providers';
import { ConfigModule } from '../common/config/config.module';
import { RedisModule } from '../common/redis/redis.module';

@Module({
  imports: [ConfigModule, RedisModule],
  providers: [StorageService, ...storageProviders],
  exports: [StorageService],
})
export class StorageModule {}
