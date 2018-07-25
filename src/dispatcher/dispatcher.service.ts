import { Injectable, OnModuleInit, OnModuleDestroy } from '@nestjs/common';
import { RabbitMQService } from '../rabbitmq/rabbitmq.service';
import { RabbitMQConnection } from '../rabbitmq/classes/rabbitmq.connection';
import { RabbitMQApiService } from '../rabbitmq/rabbitmq-api.service';
import { ConfigService } from '../config/config.service';
import amqplib from 'amqplib';

@Injectable()
export class DispatcherService implements OnModuleInit, OnModuleDestroy {
  private connection: RabbitMQConnection;

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
    this.connection = await this.rabbitMQService.connect(await this.config.getRabbitMQClient());
    await this.connection.consume(await this.config.getRabbitMQQueue(), this.onMessage);
  }

  async onMessage(msg: amqplib.Message) {
    if (!this.connection) {
      throw new Error('dispatcher: unable to handle message, connection is not started');
    }

    if (!msg || !msg.content) {
      throw new Error('dispatcher: unable to handle message, invalid message received');
    }

    const data = JSON.parse(msg.content.toString());

    if (!data.id) {
      return this.connection.reject(msg);
    }

    // post event to local legalevents, if this fails reject and deadletter it
    // get identities and create dynamic shovels for their nodes
    // copy event from the default queue to a local queue for the node
    // remove original event from local default queue by acknowledging it
  }
}
