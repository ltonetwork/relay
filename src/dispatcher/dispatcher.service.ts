import { Injectable, OnModuleInit, OnModuleDestroy } from '@nestjs/common';
import { LegalEventsService } from '../legalevents/legalevents.service';
import { RabbitMQService } from '../rabbitmq/rabbitmq.service';
import { RabbitMQConnection } from '../rabbitmq/classes/rabbitmq.connection';
import { ConfigService } from '../config/config.service';
import amqplib from 'amqplib';

@Injectable()
export class DispatcherService implements OnModuleInit, OnModuleDestroy {
  private connection: RabbitMQConnection;

  constructor(
    private readonly config: ConfigService,
    private readonly rabbitMQService: RabbitMQService,
    private readonly legalEventsService: LegalEventsService,
  ) { }

  async onModuleInit() { }

  async onModuleDestroy() {
    await this.rabbitMQService.close();
  }

  async start(): Promise<void> {
    this.connection = await this.rabbitMQService.connect(await this.config.getRabbitMQClient());

    await this.connection.consume(
      await this.config.getRabbitMQExchange(),
      await this.config.getRabbitMQQueue(),
      this.onMessage,
    );
  }

  async onMessage(msg: amqplib.Message) {
    if (!this.connection) {
      throw new Error('dispatcher: unable to handle message, connection is not started');
    }

    if (!msg || !msg.content) {
      return this.connection.reject(msg);
    }

    const event = {
      string: msg.content.toString(),
      json: null,
    };

    try {
      event.json = JSON.parse(event.string);
    } catch (e) {
      return this.connection.reject(msg);
    }

    if (!event.json || !event.json.id) {
      return this.connection.reject(msg);
    }

    const response = await this.legalEventsService.send(event.json);

    if (
      !response || response instanceof Error || !response.status ||
      [200, 201, 204].indexOf(response.status) === - 1
    ) {
      return this.connection.reject(msg);
    }

    this.connection.ack(msg);
  }
}
