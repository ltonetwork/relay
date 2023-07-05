import { Module } from '@nestjs/common';
import { InboxService } from './inbox.service';
import { inboxProviders } from './inbox.providers';
import { ConfigModule } from '../common/config/config.module';
import { RedisModule } from '../common/redis/redis.module';
import { InboxController } from './inbox.controller';

@Module({
  imports: [ConfigModule, RedisModule],
  providers: [InboxService, ...inboxProviders],
  exports: [InboxService],
  controllers: [InboxController],
})
export class InboxModule {}
