import { Injectable, Inject, OnModuleInit, OnModuleDestroy, HttpService } from '@nestjs/common';
import { AxiosResponse } from 'axios';
import { ConfigService } from '../config/config.service';

@Injectable()
export class LegalEventsService implements OnModuleInit, OnModuleDestroy {
  constructor(
    private readonly httpService: HttpService,
    private readonly configService: ConfigService,
  ) { }

  async onModuleInit() { }
  async onModuleDestroy() { }

  async send(event: any): Promise<AxiosResponse> {
    const url = await this.getUrl();
    const response = await this.httpService.post(url, event).toPromise();

    return response;
  }

  private async getUrl(): Promise<string> {
    return await this.configService.get('dispatcher.legalevents.url');
  }
}
