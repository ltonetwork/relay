import { Module } from '@nestjs/common';
import { rabbitmqProviders } from './rabbitmq.providers';
import { RabbitMQService } from './rabbitmq.service';
import { ConfigModule } from '../config/config.module';

export const RabbitMQModuleConfig = {
  imports: [ConfigModule],
  controllers: [],
  providers: [
    ...rabbitmqProviders,
    RabbitMQService,
  ],
  exports: [
    ...rabbitmqProviders,
    RabbitMQService,
  ],
};

@Module(RabbitMQModuleConfig)
export class RabbitMQModule { }
