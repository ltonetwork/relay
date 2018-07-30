import { Module } from '@nestjs/common';
import { dispatcherProviders } from './dispatcher.providers';
import { DispatcherService } from './dispatcher.service';
import { ConfigModule } from '../config/config.module';
import { LoggerModule } from '../logger/logger.module';
import { RabbitMQModule } from '../rabbitmq/rabbitmq.module';
import { LegalEventsModule } from '../legalevents/legalevents.module';

export const DispatcherModuleConfig = {
  imports: [LoggerModule, ConfigModule, RabbitMQModule, LegalEventsModule],
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
