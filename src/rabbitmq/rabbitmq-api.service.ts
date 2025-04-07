import { Injectable, BadRequestException } from '@nestjs/common';
import querystring from 'querystring';
import { AxiosResponse } from 'axios';
import { ConfigService } from '../common/config/config.service';
import { RequestService } from '../common/request/request.service';
import { LoggerService } from '../common/logger/logger.service';

@Injectable()
export class RabbitMQApiService {
  constructor(
    private readonly requestService: RequestService,
    private readonly config: ConfigService,
    private readonly logger: LoggerService,
  ) {}

  async addDynamicShovel(srcQueue: string, destUri: string): Promise<AxiosResponse> {
    try {
      const srcUri = this.config.getRabbitMQClient();
      const api = this.config.getRabbitMQApiUrl();
      const shovel = this.config.getRabbitMQShovel();
      const vhost = querystring.escape(this.config.getRabbitMQVhost());
      const url = `${api}/parameters/shovel/${vhost}/${shovel}`;
      const auth = this.config.getRabbitMQCredentials();
      const queue = this.config.getRabbitMQQueue();

      // Normalize the source URI by removing any hardcoded hostname
      const normalizedSrcUri = this.normalizeAmqpUri(srcUri);

      const data = {
        value: {
          'src-uri': normalizedSrcUri,
          'src-queue': srcQueue,
          'dest-uri': destUri,
          'dest-queue': queue,
        },
      };

      const response = await this.requestService.put(url, data, { auth });

      if (response.status >= 400) {
        throw new BadRequestException(`Failed to add shovel: ${response.statusText}`);
      }

      return response;
    } catch (error) {
      this.logger.error(`Failed to add dynamic shovel: ${error.message}`);
      throw error;
    }
  }

  private normalizeAmqpUri(uri: string): string {
    const uriObj = new URL(uri);
    uriObj.hostname = '';
    return uriObj.toString().replace(':///', '://');
  }
}
