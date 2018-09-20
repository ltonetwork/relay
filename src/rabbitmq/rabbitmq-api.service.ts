import { Injectable } from '@nestjs/common';
import querystring from 'querystring';
import { AxiosResponse } from 'axios';
import { ConfigService } from '../config/config.service';
import { RequestService } from '../request/request.service';

@Injectable()
export class RabbitMQApiService {
  constructor(
    private readonly requestService: RequestService,
    private readonly config: ConfigService,
  ) { }

  async addDynamicShovel(srcQueue: string, destUri: string): Promise<AxiosResponse | Error> {
    const srcUri = this.config.getRabbitMQClient();
    const api = this.config.getRabbitMQApiUrl();
    const shovel = this.config.getRabbitMQShovel();
    const vhost = querystring.escape(this.config.getRabbitMQVhost());
    const url = `${api}/parameters/shovel/${vhost}/${shovel}`;
    const auth = this.config.getRabbitMQCredentials();
    const queue = this.config.getRabbitMQQueue();

    const data = {
      value: {
        'src-uri': srcUri.replace('amqp://rabbitmq', 'amqp://'),
        'src-queue': srcQueue,
        'dest-uri': destUri,
        'dest-queue': queue,
      },
    };

    return await this.requestService.put(url, data, { auth });
  }
}
