import { Module } from '@nestjs/common';
import { DispatcherService } from './dispatcher.service';
import { ConfigModule } from '../common/config/config.module';
import { LoggerModule } from '../common/logger/logger.module';
import { RabbitMQModule } from '../rabbitmq/rabbitmq.module';
import { RequestModule } from '../common/request/request.module';
import { LtoIndexModule } from '../common/lto-index/lto-index.module';

@Module({
  imports: [LoggerModule, ConfigModule, RabbitMQModule, RequestModule, LtoIndexModule],
  controllers: [],
  providers: [DispatcherService],
  exports: [DispatcherService],
})
export class DispatcherModule {}
