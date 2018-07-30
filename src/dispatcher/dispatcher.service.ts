import { Injectable, OnModuleInit, OnModuleDestroy } from '@nestjs/common';
import { LegalEventsService } from '../legalevents/legalevents.service';
import { RabbitMQService } from '../rabbitmq/rabbitmq.service';
import { RabbitMQConnection } from '../rabbitmq/classes/rabbitmq.connection';
import { LoggerService } from '../logger/logger.service';
import { ConfigService } from '../config/config.service';
import amqplib from 'amqplib';

@Injectable()
export class DispatcherService implements OnModuleInit, OnModuleDestroy {
  private connection: RabbitMQConnection;

  constructor(
    private readonly logger: LoggerService,
    private readonly config: ConfigService,
    private readonly rabbitMQService: RabbitMQService,
    private readonly legalEventsService: LegalEventsService,
  ) { }

  async onModuleInit() { }

  async onModuleDestroy() {
    await this.rabbitMQService.close();
  }

  async start(): Promise<void> {
    this.logger.info('dispatcher: starting connection');
    this.connection = await this.rabbitMQService.connect(await this.config.getRabbitMQClient());

    await this.connection.consume(
      await this.config.getRabbitMQExchange(),
      await this.config.getRabbitMQQueue(),
      this.onMessage.bind(this),
    );
  }

  async onMessage(msg: amqplib.Message) {
    this.logger.info('dispatcher: message received');

    if (!this.connection) {
      this.connection = await this.rabbitMQService.connect(await this.config.getRabbitMQClient());
    }

    if (!msg || !msg.content) {
      this.logger.info('dispatcher: message deadlettered, it is invalid');
      return this.connection.deadletter(msg);
    }

    const event = {
      string: msg.content.toString(),
      json: null,
    };

    try {
      event.json = JSON.parse(event.string);
    } catch (e) {
      this.logger.info('dispatcher: message deadlettered, it is not json');
      return this.connection.deadletter(msg);
    }

    if (!event.json || !event.json.id) {
      return this.connection.deadletter(msg);
    }

    const response = await this.legalEventsService.send(event.json);

    if (
      !response || response instanceof Error || !response.status ||
      [200, 201, 204].indexOf(response.status) === - 1
    ) {
      this.logger.info('dispatcher: message deadlettered, failed to send to legalevents');
      return this.connection.deadletter(msg);
    }

    this.connection.ack(msg);
    this.logger.info('dispatcher: message acknowledged');
  }
}
