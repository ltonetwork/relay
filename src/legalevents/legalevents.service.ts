import { Injectable, Inject, OnModuleInit, OnModuleDestroy, HttpService } from '@nestjs/common';
import { AxiosResponse } from 'axios';
import { ConfigService } from '../config/config.service';

@Injectable()
export class LegalEventsService implements OnModuleInit, OnModuleDestroy {
  constructor(
    private readonly httpService: HttpService,
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
      return e;
    }
  }
}
