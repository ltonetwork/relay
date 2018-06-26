import { Injectable, Inject } from '@nestjs/common';
import amqplib from 'amqplib';
import { RABBITMQ_CONNECTION, RABBITMQ_CHANNEL } from '../constants';

@Injectable()
export class RabbitMQService {
  constructor(
    @Inject(RABBITMQ_CONNECTION) private readonly connection: amqplib.Connection,
    @Inject(RABBITMQ_CHANNEL) private readonly channel: amqplib.Channel,
  ) { }

  consume(queue: string, callback: (msg: string) => void) {
    this.assertQueue(queue);
    this.channel.consume(queue, (msg: amqplib.Message) => {
      const string = msg.content.toString();
      callback(string);
    });
  }

  produce(queue: string, msg: any) {
    this.assertQueue(queue);
    const buffer = Buffer.from(JSON.stringify(msg));
    this.channel.sendToQueue(queue, buffer);
  }

  private assertQueue(queue) {
    // @todo: specify durable, etc. for the queue
    // optionally also load that from config
    this.channel.assertQueue(queue, { durable: false });
  }

  close() {
    this.channel && this.channel.close();
    this.connection && this.connection.close();
  }
}
