import { Injectable, Inject, OnModuleInit, OnModuleDestroy, HttpService } from '@nestjs/common';
import { RabbitMQConnection } from './classes/rabbitmq.connection';
import { AMQPLIB } from '../constants';
import amqplib from 'amqplib';
import querystring from 'querystring';
import { AxiosResponse } from 'axios';
import { ConfigService } from '../config/config.service';

@Injectable()
export class RabbitMQService implements OnModuleInit, OnModuleDestroy {
  public readonly connections: { [key: string]: RabbitMQConnection } = {};

  constructor(
    private readonly httpService: HttpService,
    @Inject(AMQPLIB) private readonly _amqplib: typeof amqplib,
    private readonly config: ConfigService,
  ) { }

  async onModuleInit() { }

  async onModuleDestroy() {
    await this.close();
  }

  async connect(config: string | amqplib.Options.Connect): Promise<RabbitMQConnection> {
    const key = typeof config === 'string' ? config : config.hostname;

    if (this.connections[key]) {
      return this.connections[key];
    }

    const connection = await this._amqplib.connect(config);
    const channel = await connection.createChannel();
    this.connections[key] = new RabbitMQConnection(connection, channel);

    return this.connections[key];
  }

  async close() {
    for (const key in this.connections) {
      if (this.connections.hasOwnProperty(key)) {
        this.connections[key].close();
        delete this.connections[key];
      }
    }
  }

  async addDynamicShovel(destination: string, queue: string): Promise<AxiosResponse> {
    const api = await this.config.getRabbitMQApiUrl();
    const shovelName = 'default';
    const vhost = querystring.escape(await this.config.getRabbitMQVhost());
    const url = `${api}/parameters/shovel/${vhost}/${shovelName}`;
    const auth = await this.config.getRabbitMQCredentials();
    const data = {
      value: {
        'src-protocol': 'amqp091',
        'src-uri': 'amqp://',
        'src-queue': queue,
        'dest-protocol': 'amqp091',
        'dest-uri': destination,
        'dest-queue': 'default',
      },
    };

    const response = await this.httpService.put(url, data, { auth }).toPromise();
    return response;
  }
}
