import amqplib from 'amqplib';
import util from 'util';

export class RabbitMQConnection {
  private initialized = false;

  constructor(
    private readonly connection: amqplib.Connection,
    private readonly channel: amqplib.Channel,
  ) { }

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

  reject(message: amqplib.Message, requeue?: boolean) {
    this.channel.reject(message, requeue);
  }

  private async init(exchange: string, queue: string, pattern: string) {
    if (this.initialized) {
      return;
    }

    await this.assertExchange(exchange);
    await this.assertQueue(queue);
    await this.bindQueue(exchange, queue, pattern);

    this.initialized = true;
  }

  private async assertQueue(queue: string) {
    await this.channel.assertQueue(queue, { durable: true });
  }

  private async assertExchange(exchange: string) {
    await this.channel.assertExchange(exchange, 'direct', { durable: true });
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
}
