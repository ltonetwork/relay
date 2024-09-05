import { Module } from '@nestjs/common';
import { InboxService } from './inbox.service';
import { inboxProviders } from './inbox.providers';
import { ConfigModule } from '../common/config/config.module';
import { RedisModule } from '../common/redis/redis.module';
import { InboxController } from './inbox.controller';
import { LoggerModule } from '../common/logger/logger.module';
import { AwsModule } from '../common/aws/aws.module';

@Module({
  imports: [ConfigModule, RedisModule, LoggerModule, AwsModule],
  providers: [InboxService, ...inboxProviders],
  exports: [InboxService],
  controllers: [InboxController],
})
export class InboxModule {}
