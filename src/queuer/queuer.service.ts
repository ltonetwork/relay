import { Injectable, OnModuleInit, OnModuleDestroy } from '@nestjs/common';
import { RabbitMQService } from '../rabbitmq/rabbitmq.service';
import { RabbitMQConnection } from '../rabbitmq/classes/rabbitmq.connection';
import { ConfigService } from '../config/config.service';

@Injectable()
export class QueuerService implements OnModuleInit, OnModuleDestroy {
  private connection: RabbitMQConnection;

  constructor(
    private readonly config: ConfigService,
    private readonly rabbitMQService: RabbitMQService,
  ) { }

  async onModuleInit() { }

  async onModuleDestroy() {
    await this.rabbitMQService.close();
  }

  async add(event: any): Promise<void> {
    if (!this.connection) {
      this.connection = await this.rabbitMQService.connect(await this.config.getRabbitMQClient());
    }

    await this.connection.publish(
      await this.config.getRabbitMQExchange(),
      await this.config.getRabbitMQQueue(),
      event,
    );
    // get identities and create dynamic shovels for their nodes
    // copy event from the default queue to a local queue for the node
  }
}
