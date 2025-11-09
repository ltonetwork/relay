import { Module } from '@nestjs/common';
import { DispatcherService } from './dispatcher.service';
import { ConfigModule } from '../common/config/config.module';
import { LoggerModule } from '../common/logger/logger.module';
import { RabbitMQModule } from '../rabbitmq/rabbitmq.module';
import { RequestModule } from '../common/request/request.module';
import { BaseAnchorService } from '../common/blockchain/base-anchor.service';
import { InboxModule } from '../inbox/inbox.module';
import { RedisModule } from '../common/redis/redis.module';

@Module({
  imports: [LoggerModule, ConfigModule, RabbitMQModule, InboxModule, RequestModule, RedisModule],
  controllers: [],
  providers: [DispatcherService, BaseAnchorService],
  exports: [DispatcherService],
})
export class DispatcherModule {}
