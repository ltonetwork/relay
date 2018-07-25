import { Injectable, OnModuleInit, OnModuleDestroy } from '@nestjs/common';
import { RabbitMQService } from '../rabbitmq/rabbitmq.service';
import { RabbitMQApiService } from '../rabbitmq/rabbitmq-api.service';
import { ConfigService } from '../config/config.service';

@Injectable()
export class DispatcherService implements OnModuleInit, OnModuleDestroy {
  constructor(
    private readonly config: ConfigService,
    private readonly rabbitMQService: RabbitMQService,
    private readonly rabbitMQApiService: RabbitMQApiService,
  ) { }

  async onModuleInit() { }

  async onModuleDestroy() {
    await this.rabbitMQService.close();
  }

  async start(): Promise<void> {
    const rabbitmqConnection = await this.rabbitMQService.connect(await this.config.getRabbitMQClient());
    await rabbitmqConnection.consume(await this.config.getRabbitMQQueue(), this.onMessage);
  }

  async onMessage(msg: string) {
    // @todo:
    // check is msg is actual event
    // check if event is for the current node
    // post event to local legalevents, if this fails reject and deadletter it
    // get identities and create dynamic shovels for their nodes
    // copy event from the default queue to a local queue for the node
    // remove original event from local default queue by acknowledging it
  }
}
