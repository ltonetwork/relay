import amqplib from 'amqplib';
import type { Channel, Connection, Message, Options, Replies } from 'amqplib';
import { LoggerService } from '../../common/logger/logger.service';
import { setTimeout } from 'node:timers/promises';

export class RabbitMQConnection {
  public open: boolean;

  constructor(
    private connection: Connection | any,
    private channel: Channel | any,
    private logger: LoggerService = null,
  ) {
    this.open = true;
  }

  setConnection(connection: Connection | any): this {
    this.connection = connection;
    return this;
  }

  setChannel(channel: Channel | any): this {
    this.channel = channel;
    return this;
  }

  async consume(exchange: string, queue: string, callback: (msg: Message) => void) {
    await this.init(exchange, queue, queue);

    await this.channel.consume(
      queue,
      async (msg: amqplib.Message) => {
        await callback(msg);
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

    this.channel.publish(exchange, queue, buffer, options);
  }

  ack(message: amqplib.Message) {
    this.channel.ack(message);
  }

  reject(message: amqplib.Message) {
    this.channel.reject(message, false);
  }

  retry(message: amqplib.Message) {
    const timeouts = [5_000, 30_000, 60_000, 300_000, 900_000, 3600_000];

    message.properties.headers['x-redelivered-count'] ??= 0;
    message.properties.headers['x-redelivered-count']++;

    const redeliveredCount = message.properties.headers['x-redelivered-count'];

    this.channel.reject(message, false);

    if (isNaN(redeliveredCount) || redeliveredCount > timeouts.length) {
      this.log('warn', `message ${message.properties.messageId} deadlettered, it has been retried too many times`);
      return;
    }

    setTimeout(timeouts[redeliveredCount - 1]).then(() => {
      this.channel.sendToQueue(message.fields.routingKey, message.content, message.properties);
    });
  }

  async checkQueue(queue: string): Promise<amqplib.Replies.AssertQueue | null> {
    try {
      return await this.channel.checkQueue(queue);
    } catch (e) {
      // does not exist
      return null;
    }
  }

  async checkExchange(exchange: string): Promise<amqplib.Replies.Empty | null> {
    try {
      return await this.channel.checkExchange(exchange);
    } catch (e) {
      // does not exist
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
    await this.channel.bindQueue(queue, exchange, pattern);
  }

  // async close() {
  //   if (this.channel) {
  //     await this.channel.close();
  //   }

  //   if (this.connection) {
  //     await (this.connection as any).close();
  //   }
  // }

  async close() {
    try {
      this.open = false;

      if (this.channel) {
        await this.channel.close();
      }

      if (this.connection) {
        await (this.connection as any).close();
      }
    } catch (error) {
      this.log('error', `Error closing RabbitMQ connection: ${error.message}`);
    }
  }

  private log(level: string, msg: string) {
    if (this.logger) {
      // logger may be omitted so we do a check
      this.logger[level](msg);
    }
  }
}
