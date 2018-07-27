import { Injectable, Inject, OnModuleInit, OnModuleDestroy } from '@nestjs/common';
import { RabbitMQConnection } from './classes/rabbitmq.connection';
import { LoggerService } from '../logger/logger.service';
import { AMQPLIB } from '../constants';
import amqplib from 'amqplib';
import delay from 'delay';

@Injectable()
export class RabbitMQService implements OnModuleInit, OnModuleDestroy {
  public readonly connections: { [key: string]: RabbitMQConnection } = {};

  constructor(
    @Inject(AMQPLIB) private readonly _amqplib: typeof amqplib,
    private readonly logger: LoggerService,
  ) { }

  async onModuleInit() { }

  async onModuleDestroy() {
    await this.close();
  }

  async connect(config: string | amqplib.Options.Connect): Promise<RabbitMQConnection> {
    const key = typeof config === 'string' ? config : config.hostname;

    if (this.connections[key]) {
      return this.connections[key];
    }

    this.logger.info(`rabbitmq: attempting to connect ${key}`);

    try {
      const connection = await this._amqplib.connect(config);
      const channel = await connection.createChannel();
      this.connections[key] = new RabbitMQConnection(connection, channel);
      this.logger.info(`rabbitmq: successfully connect ${key}`);
      return this.connections[key];
    } catch (e) {
      this.logger.error(`rabbitmq: failed to connect ${key}`, { stack: e.stack });
      await delay(2000);
      return this.connect(config);
    }
  }

  async close() {
    for (const key in this.connections) {
      if (this.connections.hasOwnProperty(key)) {
        this.logger.info(`rabbitmq: closing connection ${key}`);
        this.connections[key].close();
        delete this.connections[key];
      }
    }
  }
}
