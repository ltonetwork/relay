import { Injectable, Inject, OnModuleInit, OnModuleDestroy } from '@nestjs/common';
import { RabbitMQConnection } from './classes/rabbitmq.connection';
import { AMQPLIB } from '../constants';
import amqplib from 'amqplib';

@Injectable()
export class RabbitMQService implements OnModuleInit, OnModuleDestroy {
  public readonly connections: { [key: string]: RabbitMQConnection } = {};

  constructor(@Inject(AMQPLIB) private readonly rabbitmq: typeof amqplib) { }

  async onModuleInit() { }

  async onModuleDestroy() {
    await this.close();
  }

  async connect(config: string | amqplib.Options.Connect): Promise<RabbitMQConnection> {
    const key = typeof config === 'string' ? config : config.hostname;

    if (this.connections[key]) {
      return this.connections[key];
    }

    const connection = await this.rabbitmq.connect(config);
    const channel = await connection.createChannel();
    this.connections[key] = new RabbitMQConnection(connection, channel);

    return this.connections[key];
  }

  async close() {
    for (const key in this.connections) {
      if (this.connections.hasOwnProperty(key)) {
        this.connections[key].close();
        delete this.connections[key];
      }
    }
  }
}
