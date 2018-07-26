import { Module } from '@nestjs/common';
import { queuerProviders } from './queuer.providers';
import { QueuerService } from './queuer.service';
import { ConfigModule } from '../config/config.module';
import { RabbitMQModule } from '../rabbitmq/rabbitmq.module';

export const QueuerModuleConfig = {
  imports: [ConfigModule, RabbitMQModule],
  controllers: [],
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
