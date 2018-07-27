import { Injectable, Inject, OnModuleInit, OnModuleDestroy, HttpService, Logger } from '@nestjs/common';
import { AxiosResponse } from 'axios';
import { LoggerService } from '../logger/logger.service';
import { ConfigService } from '../config/config.service';

@Injectable()
export class LegalEventsService implements OnModuleInit, OnModuleDestroy {
  constructor(
    private readonly httpService: HttpService,
    private readonly logger: LoggerService,
    private readonly config: ConfigService,
  ) { }

  async onModuleInit() { }
  async onModuleDestroy() { }

  async send(event: any): Promise<AxiosResponse | Error> {
    const url = await this.config.getLegalEventsUrl();

    try {
      const response = await this.httpService.post(url, event).toPromise();
      return response;
    } catch (e) {
      this.logger.error(`legalevents: failed to send, error: '${e}'`, {
        stack: e.stack,
        response: e.response.data,
      });
      return e;
    }
  }
}
