import { Injectable, HttpService } from '@nestjs/common';
import querystring from 'querystring';
import { AxiosResponse } from 'axios';
import { ConfigService } from '../config/config.service';

@Injectable()
export class RabbitMQApiService {
  constructor(
    private readonly httpService: HttpService,
    private readonly config: ConfigService,
  ) { }

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
