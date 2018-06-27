import { Injectable, Inject, OnModuleInit, OnModuleDestroy } from '@nestjs/common';
import { RABBITMQ_CONNECTION, RABBITMQ_CHANNEL } from '../constants';
import amqplib from 'amqplib';

@Injectable()
export class RabbitMQService implements OnModuleInit, OnModuleDestroy {
  async onModuleInit() { }

  async onModuleDestroy() {
    await this.close();
  }

  constructor(
    @Inject(RABBITMQ_CONNECTION) private readonly connection: amqplib.Connection,
    @Inject(RABBITMQ_CHANNEL) private readonly channel: amqplib.Channel,
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
