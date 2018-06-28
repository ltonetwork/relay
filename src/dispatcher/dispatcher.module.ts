import { Module } from '@nestjs/common';
import { dispatcherProviders } from './dispatcher.providers';
import { DispatcherService } from './dispatcher.service';
import { ConfigModule } from '../config/config.module';
import { RabbitMQModule } from '../rabbitmq/rabbitmq.module';

export const DispatcherModuleConfig = {
  imports: [ConfigModule, RabbitMQModule],
  controllers: [],
  providers: [
    ...dispatcherProviders,
    DispatcherService,
  ],
  exports: [
    ...dispatcherProviders,
    DispatcherService,
  ],
};

@Module(DispatcherModuleConfig)
export class DispatcherModule { }
