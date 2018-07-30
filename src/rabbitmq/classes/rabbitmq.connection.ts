import amqplib from 'amqplib';
import util from 'util';

export class RabbitMQConnection {
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

  requeue(message: amqplib.Message) {
    this.channel.git reject(message, true);
  }

  deadletter(message: amqplib.Message) {
    this.channel.reject(message, false);
  }

  private async init(exchange: string, queue: string, pattern: string) {
    // create queue
    await this.assertExchange(exchange);
    await this.assertQueue(queue, {
      durable: true,
      deadLetterExchange: `${exchange}.deadletter`,
      deadLetterRoutingKey: `${queue}.deadletter`,
    });
    await this.bindQueue(exchange, queue, pattern);

    // create deadletter
    await this.assertExchange(`${exchange}.deadletter`);
    await this.assertQueue(`${queue}.deadletter`);
    await this.bindQueue(`${exchange}.deadletter`, `${queue}.deadletter`, `${queue}.deadletter`);
  }

  private async assertQueue(
    queue: string,
    options: amqplib.Options.AssertQueue = { durable: true },
  ) {
    await this.channel.assertQueue(queue, options);
  }

  private async assertExchange(
    exchange: string,
    type: string = 'direct',
    options: amqplib.Options.AssertExchange = { durable: true },
  ) {
    await this.channel.assertExchange(exchange, type, options);
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
