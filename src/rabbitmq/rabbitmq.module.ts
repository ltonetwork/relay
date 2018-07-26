import { Module, HttpModule } from '@nestjs/common';
import { rabbitmqProviders } from './rabbitmq.providers';
import { RabbitMQService } from './rabbitmq.service';
import { RabbitMQApiService } from './rabbitmq-api.service';
import { LoggerModule } from '../logger/logger.module';
import { ConfigModule } from '../config/config.module';

export const RabbitMQModuleConfig = {
  imports: [ConfigModule, LoggerModule, HttpModule],
  controllers: [],
  providers: [
    ...rabbitmqProviders,
    RabbitMQService,
    RabbitMQApiService,
  ],
  exports: [
    ...rabbitmqProviders,
    RabbitMQService,
    RabbitMQApiService,
  ],
};

@Module(RabbitMQModuleConfig)
export class RabbitMQModule { }
