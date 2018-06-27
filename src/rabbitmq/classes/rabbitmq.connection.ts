import amqplib from 'amqplib';

export class RabbitMQConnection {
  constructor(
    private readonly connection: amqplib.Connection,
    private readonly channel: amqplib.Channel,
  ) { }

  async consume(queue: string, callback: (msg: string) => void) {
    this.assertQueue(queue);
    await this.channel.consume(queue, (msg: amqplib.Message) => {
      const string = msg.content.toString();
      callback(string);
    });
  }

  async produce(queue: string, msg: any) {
    this.assertQueue(queue);
    const buffer = Buffer.from(JSON.stringify(msg));
    await this.channel.sendToQueue(queue, buffer);
  }

  private assertQueue(queue) {
    // @todo: specify durable, etc. for the queue
    // optionally also load that from config
    this.channel.assertQueue(queue, { durable: false });
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
