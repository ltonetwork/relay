import { Module } from '@nestjs/common';
import { DispatcherService } from './dispatcher.service';
import { ConfigModule } from '../common/config/config.module';
import { LoggerModule } from '../common/logger/logger.module';
import { RabbitMQModule } from '../rabbitmq/rabbitmq.module';
import { RequestModule } from '../common/request/request.module';
import { LtoIndexModule } from '../common/lto-index/lto-index.module';
import { StorageModule } from '../storage/storage.module';

@Module({
  imports: [LoggerModule, ConfigModule, RabbitMQModule, StorageModule, RequestModule, LtoIndexModule],
  controllers: [],
  providers: [DispatcherService],
  exports: [DispatcherService],
})
export class DispatcherModule {}
