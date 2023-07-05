import { Module } from '@nestjs/common';
import { InboxService } from './inbox.service';
import { inboxProviders } from './inbox.providers';
import { ConfigModule } from '../common/config/config.module';
import { RedisModule } from '../common/redis/redis.module';
import { InboxController } from './inbox.controller';
import { LoggerModule } from '../common/logger/logger.module';

@Module({
  imports: [ConfigModule, RedisModule, LoggerModule],
  providers: [InboxService, ...inboxProviders],
  exports: [InboxService],
  controllers: [InboxController],
})
export class InboxModule {}
