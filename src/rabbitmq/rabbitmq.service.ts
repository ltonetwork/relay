import { Injectable, Inject, OnModuleInit, OnModuleDestroy } from '@nestjs/common';
import { RabbitMQConnection } from './classes/rabbitmq.connection';
import { LoggerService } from '../common/logger/logger.service';
import { AMQPLIB } from '../constants';
import amqplib from 'amqplib';
import { setTimeout } from 'node:timers/promises';

@Injectable()
export class RabbitMQService implements OnModuleInit, OnModuleDestroy {
  public readonly connections: Record<string, RabbitMQConnection> = {};

  constructor(@Inject(AMQPLIB) private readonly _amqplib: typeof amqplib, private readonly logger: LoggerService) {}

  async onModuleInit() {}

  async onModuleDestroy() {
    await this.close();
  }

  async connect(config: string | amqplib.Options.Connect): Promise<RabbitMQConnection> {
    const key = typeof config === 'string' ? config : config.hostname;

    if (this.connections[key] && this.connections[key].open) {
      return this.connections[key];
    }

    if (this.connections[key] && !this.connections[key].open) {
      return this.reopen(config);
    }

    this.logger.debug(`rabbitmq: attempting to connect ${key}`);

    try {
      const connection = await this._amqplib.connect(config);
      const channel = await connection.createChannel();
      this.onError(channel, config);
      this.connections[key] = new RabbitMQConnection(connection, channel, this.logger);
      this.logger.info(`rabbitmq: successfully connected ${key}`);
      return this.connections[key];
    } catch (e) {
      this.logger.error(`rabbitmq: failed to connect ${key} '${e}'`);
      await setTimeout(2000);
      return this.connect(config);
    }
  }

  private async reopen(config: string | amqplib.Options.Connect): Promise<RabbitMQConnection> {
    const key = typeof config === 'string' ? config : config.hostname;
    this.logger.debug(`rabbitmq: attempting to reopen connection ${key}`);

    try {
      const connection = await this._amqplib.connect(config);
      const channel = await connection.createChannel();
      this.onError(channel, config);
      this.connections[key].setChannel(channel).setConnection(connection);
      this.connections[key].open = true;
      this.logger.info(`rabbitmq: successfully reopened connection ${key}`);
      return this.connections[key];
    } catch (e) {
      this.logger.error(`rabbitmq: failed to reopen connection ${key} '${e}'`);
      await setTimeout(1000);
      return this.reopen(config);
    }
  }

  private onError(channel: amqplib.Channel, config: string | amqplib.Options.Connect) {
    const key = typeof config === 'string' ? config : config.hostname;

    channel.on('error', async (e) => {
      this.logger.error(`rabbitmq: channel received error '${e}'`);
      this.connections[key].open = false;
      await this.connect(config);
    });
  }

  async close() {
    await Promise.all(Object.keys(this.connections).map((key) => {
      this.logger.info(`rabbitmq: closing connection ${key}`);
      this.connections[key].close();
      delete this.connections[key];
    }));
  }
}
