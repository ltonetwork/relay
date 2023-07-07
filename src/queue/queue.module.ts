import { Module } from '@nestjs/common';
import { QueueService } from './queue.service';
import { QueueController } from './queue.controller';
import { LoggerModule } from '../common/logger/logger.module';
import { ConfigModule } from '../common/config/config.module';
import { RabbitMQModule } from '../rabbitmq/rabbitmq.module';
import { DidResolverModule } from '../common/did-resolver/did-resolver.module';

@Module({
  imports: [LoggerModule, ConfigModule, RabbitMQModule, DidResolverModule],
  controllers: [QueueController],
  providers: [QueueService],
  exports: [QueueService],
})
export class QueueModule {}
