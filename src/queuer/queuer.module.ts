import { Module } from '@nestjs/common';
import { queuerProviders } from './queuer.providers';
import { QueuerService } from './queuer.service';
import { QueuerController } from './queuer.controller';
import { LoggerModule } from '../logger/logger.module';
import { ConfigModule } from '../config/config.module';
import { RabbitMQModule } from '../rabbitmq/rabbitmq.module';

export const QueuerModuleConfig = {
  imports: [LoggerModule, ConfigModule, RabbitMQModule],
  controllers: [QueuerController],
  providers: [
    ...queuerProviders,
    QueuerService,
  ],
  exports: [
    ...queuerProviders,
    QueuerService,
  ],
};

@Module(QueuerModuleConfig)
export class QueuerModule { }
