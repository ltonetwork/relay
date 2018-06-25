import { Module } from '@nestjs/common';
import { RabbitMQService } from './rabbitmq.service';

@Module({
  imports: [],
  controllers: [],
  providers: [RabbitMQService],
  exports: [RabbitMQService],
})
export class RabbitMQModule {}
