import { Injectable } from '@nestjs/common';
import { connect, Connection, Channel } from 'amqplib';
import { RabbitMQConfig } from './interfaces/rabbitmq-config';

@Injectable()
export class RabbitMQService {
  private connection: Connection;
  private channel: Channel;
  private config: RabbitMQConfig;

  async connect(config: RabbitMQConfig): Promise<void> {
    this.config = config;
    this.connection = await connect(await this.config.url);
    this.channel = await this.connection.createChannel();
    this.channel.assertQueue(`${this.config.queue}_sub`, { durable: false });
    this.channel.assertQueue(`${this.config.queue}_pub`, { durable: false });
  }

  consume() {
    // this.channel.consume(`${this.config.queue}_sub`, this.handleMessage.bind(this), {
    //   noAck: true,
    // });
  }

  close(): void {
    this.channel && this.channel.close();
    this.connection && this.connection.close();
  }
}
