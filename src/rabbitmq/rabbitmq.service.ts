import { Injectable, Inject, OnModuleInit, OnModuleDestroy } from '@nestjs/common';
import { RabbitMQConnection } from './classes/rabbitmq.connection';
import { LoggerService } from '../common/logger/logger.service';
import { AMQPLIB } from '../constants';
import amqplib from 'amqplib';
import { setTimeout } from 'node:timers/promises';
import { ConfigService } from '../common/config/config.service';

@Injectable()
export class RabbitMQService implements OnModuleInit, OnModuleDestroy {
  public readonly connections: Record<string, RabbitMQConnection> = {};
  private readonly maxReconnectAttempts = 5;

  constructor(
    @Inject(AMQPLIB) private readonly _amqplib: typeof amqplib,
    private readonly logger: LoggerService,
    private readonly config: ConfigService,
  ) {}

  async onModuleInit() {}

  async onModuleDestroy() {
    await this.close();
  }

  async connect(config: string | amqplib.Options.Connect): Promise<RabbitMQConnection> {
    const key = typeof config === 'string' ? config : config.hostname;
    const maxRetries = 5;
    let retryCount = 0;

    while (retryCount < maxRetries) {
      try {
        if (this.connections[key] && this.connections[key].open) {
          return this.connections[key];
        }

        if (this.connections[key] && !this.connections[key].open) {
          return this.reopen(config);
        }

        this.logger.debug(`rabbitmq: attempting to connect ${key}`);

        const connection = await this._amqplib.connect(config);
        const channel = await connection.createChannel();

        this.onError(channel, config);
        this.connections[key] = new RabbitMQConnection(connection, channel, this.logger);
        this.logger.info(`rabbitmq: successfully connected ${key}`);
        return this.connections[key];
      } catch (e) {
        retryCount++;
        const delay = this.calculateBackoff(retryCount);
        this.logger.error(`rabbitmq: failed to connect ${key} '${e}' (attempt ${retryCount}/${maxRetries})`);
        if (retryCount === maxRetries) {
          throw new Error(`Failed to connect to RabbitMQ after ${maxRetries} attempts`);
        }
        await setTimeout(delay);
      }
    }
  }

  private calculateBackoff(attempt: number): number {
    const exponentialDelay = Math.min(1000 * Math.pow(2, attempt - 1), 30000);
    const jitter = Math.random() * 1000;
    return exponentialDelay + jitter;
  }

  private async reopen(config: string | amqplib.Options.Connect): Promise<RabbitMQConnection> {
    const key = typeof config === 'string' ? config : config.hostname;
    this.logger.debug(`rabbitmq: attempting to reopen connection ${key}`);

    try {
      const connection = await this._amqplib.connect(config);
      const channel = await connection.createChannel();
      this.connections[key].setChannel(channel).setConnection(connection);
      this.connections[key].open = true;
      this.logger.info(`rabbitmq: successfully reopened connection ${key}`);
      return this.connections[key];
    } catch (e) {
      this.logger.error(`rabbitmq: failed to reopen connection ${key} '${e}'`);
      const delay = this.calculateBackoff(1);
      await setTimeout(delay);
      return this.reopen(config);
    }
  }

  private onError(channel: amqplib.Channel, config: string | amqplib.Options.Connect) {
    const key = typeof config === 'string' ? config : config.hostname;
    let reconnectAttempts = 0;

    channel.on('error', async (e) => {
      this.logger.error(`rabbitmq: channel received error '${e}'`);
      this.connections[key].open = false;

      if (reconnectAttempts < this.maxReconnectAttempts) {
        reconnectAttempts++;
        const delay = this.calculateBackoff(reconnectAttempts);
        await setTimeout(delay);
        await this.connect(config);
      } else {
        this.logger.error(`rabbitmq: max reconnection attempts reached for ${key}`);
      }
    });
  }

  async close(): Promise<void> {
    const closePromises = Object.keys(this.connections).map(async (key) => {
      try {
        this.logger.info(`rabbitmq: closing connection ${key}`);
        await this.connections[key].close();
        delete this.connections[key];
      } catch (error) {
        this.logger.error(`rabbitmq: error closing connection ${key}: ${error.message}`);
      }
    });

    await Promise.all(closePromises);
  }
}
