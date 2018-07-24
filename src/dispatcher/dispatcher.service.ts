import { Injectable, OnModuleInit, OnModuleDestroy } from '@nestjs/common';
import { RabbitMQService } from '../rabbitmq/rabbitmq.service';
import { ConfigService } from '../config/config.service';

@Injectable()
export class DispatcherService implements OnModuleInit, OnModuleDestroy {
  constructor(
    private readonly configService: ConfigService,
    private readonly rabbitMQService: RabbitMQService,
  ) { }

  async onModuleInit() { }

  async onModuleDestroy() {
    await this.rabbitMQService.close();
  }

  async start(): Promise<void> {
    const config = await this.configService.get('dispatcher');
    const rabbitmqConnection = await this.rabbitMQService.connect(config.rabbitmq.client);
    await rabbitmqConnection.consume(config.rabbitmq.queue, this.onMessage);
  }

  private onMessage(msg: string) {
    // @todo:
    // check is msg is actual event
    // check if event is for the current node
    // post event to local legalevents
    // get identities and create dynamic shovels for their nodes
    // copy event from the default queue to a local queue for the node
    // remove original event from local default queue by acknowledging it
  }
}
