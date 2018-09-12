import amqplib from 'amqplib';
import util from 'util';
import { LoggerService } from '../../logger/logger.service';
import delay from 'delay';

export class RabbitMQConnection {
  public open: boolean;

  constructor(
    private connection: amqplib.Connection,
    private channel: amqplib.Channel,
    private logger: LoggerService = null,
  ) {
    this.open = true;
  }

  setConnection(connection: amqplib.Connection): this {
    this.connection = connection;
    return this;
  }

  setChannel(channel: amqplib.Channel): this {
    this.channel = channel;
    return this;
  }

  async consume(exchange: string, queue: string, callback: (msg: amqplib.Message) => void) {
    await this.init(exchange, queue, queue);

    await this.channel.consume(queue, async (msg: amqplib.Message) => {
      await callback(msg);
    }, { noAck: false });
  }

  async publish(exchange: string, queue: string, msg: string | object) {
    await this.init(exchange, queue, queue);

    const data = util.isString(msg) ? msg : JSON.stringify(msg);
    const buffer = Buffer.from(data);
    await this.channel.publish(exchange, queue, buffer);
  }

  ack(message: amqplib.Message) {
    this.channel.ack(message);
  }

  requeue(message: amqplib.Message) {
    this.channel.reject(message, true);
  }

  deadletter(message: amqplib.Message) {
    this.channel.reject(message, false);
  }

  async checkQueue(queue: string): Promise<amqplib.Replies.AssertQueue | null> {
    try {
      const result = await this.channel.checkQueue(queue);
      return result;
    } catch (e) {
      // does not exist
      return null;
    }
  }

  async checkExchange(exchange: string): Promise<amqplib.Replies.Empty | null> {
    try {
      const result = await this.channel.checkExchange(exchange);
      return result;
    } catch (e) {
      // does not exist
      return null;
    }
  }

  private async init(exchange: string, queue: string, pattern: string) {
      // deadletter
      await this.assertExchange(`${exchange}.deadletter`);
      await this.assertQueue(`${queue}.deadletter`);
      await this.bindQueue(`${exchange}.deadletter`, `${queue}.deadletter`, `${pattern}.deadletter`);

      // regular
      await this.assertExchange(exchange);
      await this.assertQueue(queue, {
        durable: true,
        deadLetterExchange: `${exchange}.deadletter`,
        deadLetterRoutingKey: `${queue}.deadletter`,
      });
      await this.bindQueue(exchange, queue, pattern);
    }

  private async assertQueue(
    queue: string,
    options: amqplib.Options.AssertQueue = { durable: true },
  ) {
    try {
      this.log('debug', `rabbitmq-connection: attempting to assert queue '${queue}'`);
      await this.channel.assertQueue(queue, options);
      this.log('debug', `rabbitmq-connection: successfully asserted queue '${queue}'`);
    } catch (e) {
      this.log('error', `rabbitmq-connection: failed to assert queue '${e}'`);
      await delay(1500);
      return this.assertQueue(queue, options);
    }
  }

  private async assertExchange(
    exchange: string,
    type: string = 'direct',
    options: amqplib.Options.AssertExchange = { durable: true },
  ) {
    try {
      this.log('debug', `rabbitmq-connection: attempting to assert exchange '${exchange}'`);
      await this.channel.assertExchange(exchange, type, options);
      this.log('debug', `rabbitmq-connection: successfully asserted exchange '${exchange}'`);
    } catch (e) {
      this.log('error', `rabbitmq-connection: failed to assert exchange '${e}'`);
      await delay(1500);
      return this.assertExchange(exchange, type, options);
    }
  }

  private async bindQueue(exchange: string, queue: string, pattern: string) {
    await this.channel.bindQueue(queue, exchange, pattern);
  }

  async close() {
    if (this.channel) {
      await this.channel.close();
    }

    if (this.connection) {
      await this.connection.close();
    }
  }

  private log(level: string, msg: string) {
    if (this.logger) {
      // logger may be omitted so we do a check
      this.logger[level](msg);
    }
  }
}
