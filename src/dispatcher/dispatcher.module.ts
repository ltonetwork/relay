import { Module } from '@nestjs/common';
import { DispatcherService } from './dispatcher.service';
import { ConfigModule } from '../common/config/config.module';
import { LoggerModule } from '../common/logger/logger.module';
import { RabbitMQModule } from '../rabbitmq/rabbitmq.module';
import { LtoIndexModule } from '../common/lto-index/lto-index.module';

export const DispatcherModuleConfig = {
  imports: [LoggerModule, ConfigModule, RabbitMQModule, LtoIndexModule],
  controllers: [],
  providers: [DispatcherService],
  exports: [DispatcherService],
};

@Module(DispatcherModuleConfig)
export class DispatcherModule {}
