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
    const srcUri = await this.config.getRabbitMQClient();
    const api = await this.config.getRabbitMQApiUrl();
    const shovel = await this.config.getRabbitMQShovel();
    const vhost = querystring.escape(await this.config.getRabbitMQVhost());
    const url = `${api}/parameters/shovel/${vhost}/${shovel}`;
    const auth = await this.config.getRabbitMQCredentials();
    const queue = await this.config.getRabbitMQQueue();
    const data = {
      value: {
        'src-uri': srcUri,
        'src-queue': srcQueue,
        'dest-uri': destUri,
        'dest-queue': queue,
      },
    };

    return await this.requestService.put(url, data, { auth });
  }
}
