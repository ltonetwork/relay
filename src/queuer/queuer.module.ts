import { Module } from '@nestjs/common';
import { queuerProviders } from './queuer.providers';
import { QueuerService } from './queuer.service';
import { QueuerController } from './queuer.controller';
import { ConfigModule } from '../config/config.module';
import { RabbitMQModule } from '../rabbitmq/rabbitmq.module';

export const QueuerModuleConfig = {
  imports: [ConfigModule, RabbitMQModule],
  controllers: [],
  providers: [
    ...queuerProviders,
    QueuerService,
    QueuerController,
  ],
  exports: [
    ...queuerProviders,
    QueuerService,
    QueuerController,
  ],
};

@Module(QueuerModuleConfig)
export class QueuerModule { }
