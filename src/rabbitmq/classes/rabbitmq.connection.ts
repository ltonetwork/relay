import amqplib from 'amqplib';
import type { Channel, Connection, Message, Options } from 'amqplib';
import { LoggerService } from '../../common/logger/logger.service';
import { setTimeout } from 'node:timers/promises';

export interface RetryConfig {
  timeouts: number[];
  maxRetries: number;
}

export class RabbitMQConnection {
  public open: boolean;
  private retryConfig: RetryConfig = {
    timeouts: [5_000, 30_000, 60_000, 300_000, 900_000, 3600_000],
    maxRetries: 6,
  };

  constructor(
<<<<<<< HEAD
    private connection: Connection | any,
    private channel: Channel | any,
=======
    private connection: amqplib.Connection | any,
    private channel: amqplib.Channel | any,
>>>>>>> orelay
    private logger: LoggerService = null,
  ) {
    this.open = true;
  }

<<<<<<< HEAD
  setConnection(connection: Connection | any): this {
=======
  setConnection(connection: amqplib.Connection | any): this {
>>>>>>> orelay
    this.connection = connection;
    return this;
  }

<<<<<<< HEAD
  setChannel(channel: Channel | any): this {
=======
  setChannel(channel: amqplib.Channel | any): this {
>>>>>>> orelay
    this.channel = channel;
    return this;
  }

<<<<<<< HEAD
  async consume(exchange: string, queue: string, callback: (msg: Message) => void) {
=======
  setRetryConfig(config: Partial<RetryConfig>): this {
    this.retryConfig = { ...this.retryConfig, ...config };
    return this;
  }

  async consume(exchange: string, queue: string, callback: (msg: amqplib.Message) => void) {
>>>>>>> orelay
    await this.init(exchange, queue, queue);

    await this.channel.consume(
      queue,
      async (msg: amqplib.Message) => {
        try {
          await callback(msg);
        } catch (error) {
          this.log('error', `Error processing message: ${error.message}`);
          this.reject(msg);
        }
      },
      { noAck: false },
    );
  }

  async publish(exchange: string, queue: string, msg: string | object, options: Options.Publish = {}) {
    await this.init(exchange, queue, queue);

    let buffer: Buffer;

    if (msg instanceof Uint8Array) {
      buffer = Buffer.from(msg);
      options.contentType ??= 'application/octet-stream';
    } else if (typeof msg === 'string') {
      buffer = Buffer.from(msg);
      options.contentType ??= 'application/octet-stream';
    } else {
      options.contentType ??= 'application/json';
      buffer = Buffer.from(JSON.stringify(msg));
    }

    try {
      this.channel.publish(exchange, queue, buffer, options);
    } catch (error) {
      this.log('error', `Failed to publish message: ${error.message}`);
      throw error;
    }
  }

  ack(message: amqplib.Message) {
    try {
      this.channel.ack(message);
    } catch (error) {
      this.log('error', `Failed to acknowledge message: ${error.message}`);
      throw error;
    }
  }

  reject(message: amqplib.Message) {
    try {
      this.channel.reject(message, false);
    } catch (error) {
      this.log('error', `Failed to reject message: ${error.message}`);
      throw error;
    }
  }

  retry(message: amqplib.Message) {
    try {
      message.properties.headers['x-redelivered-count'] ??= 0;
      message.properties.headers['x-redelivered-count']++;

      const redeliveredCount = message.properties.headers['x-redelivered-count'];

      this.channel.reject(message, false);

      if (isNaN(redeliveredCount) || redeliveredCount > this.retryConfig.maxRetries) {
        this.log('warn', `message ${message.properties.messageId} deadlettered, it has been retried too many times`);
        return;
      }

      const timeout =
        this.retryConfig.timeouts[redeliveredCount - 1] ||
        this.retryConfig.timeouts[this.retryConfig.timeouts.length - 1];

      setTimeout(timeout).then(() => {
        try {
          this.channel.sendToQueue(message.fields.routingKey, message.content, message.properties);
        } catch (error) {
          this.log('error', `Failed to requeue message: ${error.message}`);
        }
      });
    } catch (error) {
      this.log('error', `Failed to retry message: ${error.message}`);
      throw error;
    }
  }

  async checkQueue(queue: string): Promise<amqplib.Replies.AssertQueue | null> {
    try {
      return await this.channel.checkQueue(queue);
    } catch (e) {
      return null;
    }
  }

  async checkExchange(exchange: string): Promise<amqplib.Replies.Empty | null> {
    try {
      return await this.channel.checkExchange(exchange);
    } catch (e) {
      return null;
    }
  }

  async init(exchange: string, queue: string, pattern: string) {
    try {
      if (!this.channel || !this.open) {
        throw new Error('Channel not available');
      }

      // deadletter
      const deadLetterExchange =
        exchange === '' || exchange.startsWith('amq.') ? 'deadletter' : `${exchange}.deadletter`;
      await this.assertExchange(deadLetterExchange);
      await this.assertQueue(`${queue}.deadletter`);
      await this.bindQueue(deadLetterExchange, `${queue}.deadletter`, `${pattern}.deadletter`);

      // regular
      await this.assertExchange(exchange);
      await this.assertQueue(queue, {
        durable: true,
        deadLetterExchange,
        deadLetterRoutingKey: `${queue}.deadletter`,
      });
      await this.bindQueue(exchange, queue, pattern);
    } catch (e) {
      if (e.message.includes('Channel closed')) {
        this.open = false;
        throw e; //trigger reconnection
      }
      throw e;
    }
  }

  private async assertQueue(queue: string, options: amqplib.Options.AssertQueue = { durable: true }) {
    try {
      await this.channel.assertQueue(queue, options);
      this.log('debug', `rabbitmq-connection: successfully asserted queue '${queue}'`);
    } catch (e) {
      this.log('error', `rabbitmq-connection: failed to assert queue '${e}'`);
      await setTimeout(1500);
      return this.assertQueue(queue, options);
    }
  }

  private async assertExchange(
    exchange: string,
    type = 'direct',
    options: amqplib.Options.AssertExchange = { durable: true },
  ) {
    try {
      if (!this.channel || !this.open) {
        throw new Error('Channel not available');
      }
      await this.channel.assertExchange(exchange, type, options);
      this.log('debug', `rabbitmq-connection: successfully asserted exchange '${exchange}'`);
    } catch (e) {
      this.log('error', `rabbitmq-connection: failed to assert exchange '${e}'`);
      if (e.message.includes('Channel closed')) {
        this.open = false;
        throw e; // trigger reconnection
      }
      await setTimeout(1500);
      return this.assertExchange(exchange, type, options);
    }
  }

  private async bindQueue(exchange: string, queue: string, pattern: string) {
    try {
      await this.channel.bindQueue(queue, exchange, pattern);
    } catch (error) {
      this.log('error', `Failed to bind queue: ${error.message}`);
      throw error;
    }
  }

  async close(): Promise<boolean> {
    try {
      this.open = false;

      if (this.channel) {
        await this.channel.close();
      }

      if (this.connection) {
        await (this.connection as any).close();
      }

      return true;
    } catch (error) {
      this.log('error', `Error closing RabbitMQ connection: ${error.message}`);
      return false;
    }
  }

  private log(level: string, msg: string) {
    if (this.logger) {
      this.logger[level](msg);
    }
  }
}
