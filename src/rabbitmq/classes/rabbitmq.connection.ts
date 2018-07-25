import amqplib from 'amqplib';
import util from 'util';

export class RabbitMQConnection {
  constructor(
    private readonly connection: amqplib.Connection,
    private readonly channel: amqplib.Channel,
  ) { }

  async consume(queue: string, callback: (msg: amqplib.Message) => void) {
    this.assertQueue(queue);
    await this.channel.consume(queue, async (msg: amqplib.Message) => {
      await callback(msg);
    }, { noAck: false });
  }

  async produce(queue: string, msg: any) {
    this.assertQueue(queue);
    const data = util.isString(msg) ? msg : JSON.stringify(msg);
    const buffer = Buffer.from(data);
    await this.channel.sendToQueue(queue, buffer);
  }

  ack(message: amqplib.Message) {
    this.channel.ack(message);
  }

  reject(message: amqplib.Message, requeue?: boolean) {
    this.channel.reject(message, requeue);
  }

  private assertQueue(queue) {
    this.channel.assertQueue(queue, { durable: true });
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
