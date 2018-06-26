import { Module } from '@nestjs/common';
import { rabbitmqProviders } from './rabbitmq.providers';
import { RabbitMQService } from './rabbitmq.service';
import { ConfigModule } from '../config/config.module';

@Module({
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
})
export class RabbitMQModule { }
