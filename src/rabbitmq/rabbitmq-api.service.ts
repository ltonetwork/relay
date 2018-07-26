import { Injectable, HttpService } from '@nestjs/common';
import querystring from 'querystring';
import { AxiosResponse } from 'axios';
import { LoggerService } from '../logger/logger.service';
import { ConfigService } from '../config/config.service';

@Injectable()
export class RabbitMQApiService {
  constructor(
    private readonly httpService: HttpService,
    private readonly logger: LoggerService,
    private readonly config: ConfigService,
  ) { }

  async addDynamicShovel(srcQueue: string, destUri: string): Promise<AxiosResponse | Error> {
    const api = await this.config.getRabbitMQApiUrl();
    const shovel = await this.config.getRabbitMQShovel();
    const vhost = querystring.escape(await this.config.getRabbitMQVhost());
    const url = `${api}/parameters/shovel/${vhost}/${shovel}`;
    const auth = await this.config.getRabbitMQCredentials();
    const queue = await this.config.getRabbitMQQueue();
    const data = {
      value: {
        'src-protocol': 'amqp091',
        'src-uri': 'amqp://',
        'src-queue': srcQueue,
        'dest-protocol': 'amqp091',
        'dest-uri': destUri,
        'dest-queue': queue,
      },
    };

    try {
      const response = await this.httpService.put(url, data, { auth }).toPromise();
      return response;
    } catch (e) {
      this.logger.error(`queuer: failed to add shovel for remote node: '${e}'`);
      return e;
    }
  }
}
