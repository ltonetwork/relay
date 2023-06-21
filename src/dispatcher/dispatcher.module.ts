import { Module } from '@nestjs/common';
import { dispatcherProviders } from './dispatcher.providers';
import { DispatcherService } from './dispatcher.service';
import { ConfigModule } from '../common/config/config.module';
import { LoggerModule } from '../common/logger/logger.module';
import { RabbitMQModule } from '../rabbitmq/rabbitmq.module';

export const DispatcherModuleConfig = {
  imports: [LoggerModule, ConfigModule, RabbitMQModule],
  controllers: [],
  providers: [...dispatcherProviders, DispatcherService],
  exports: [...dispatcherProviders, DispatcherService],
};

@Module(DispatcherModuleConfig)
export class DispatcherModule {}
