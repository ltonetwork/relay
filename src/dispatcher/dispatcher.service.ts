import { Injectable, OnModuleInit, OnModuleDestroy } from '@nestjs/common';
import { RabbitMQService } from '../rabbitmq/rabbitmq.service';
import { ConfigService } from '../config/config.service';

@Injectable()
export class DispatcherService implements OnModuleInit, OnModuleDestroy {
  constructor(
    private readonly configService: ConfigService,
    private readonly rabbitMQService: RabbitMQService,
  ) { }

  async onModuleInit() {
  }

  async onModuleDestroy() {
    await this.rabbitMQService.close();
  }

  async start(): Promise<void> {
    const config = await this.configService.get('dispatcher');
    const rabbitmqConnection = await this.rabbitMQService.connect(config.rabbitmq);
    await rabbitmqConnection.consume(config.queue, this.onMessage);
  }

  private onMessage(msg: string) {
    // tslint:disable-next-line:no-console
    console.log('received msg in dispatcher', msg);
  }
}
