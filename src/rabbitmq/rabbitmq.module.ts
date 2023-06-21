import { Module } from '@nestjs/common';
import { rabbitmqProviders } from './rabbitmq.providers';
import { RabbitMQService } from './rabbitmq.service';
import { RabbitMQApiService } from './rabbitmq-api.service';
import { LoggerModule } from '../common/logger/logger.module';
import { ConfigModule } from '../common/config/config.module';
import { RequestModule } from '../request/request.module';

export const RabbitMQModuleConfig = {
  imports: [LoggerModule, ConfigModule, RequestModule],
  controllers: [],
  providers: [...rabbitmqProviders, RabbitMQService, RabbitMQApiService],
  exports: [...rabbitmqProviders, RabbitMQService, RabbitMQApiService],
};

@Module(RabbitMQModuleConfig)
export class RabbitMQModule {}
