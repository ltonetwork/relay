import { Injectable, OnModuleInit, OnModuleDestroy } from '@nestjs/common';
import { AxiosResponse } from 'axios';
import { ConfigService } from '../config/config.service';
import { RequestService } from '../request/request.service';

@Injectable()
export class LegalEventsService implements OnModuleInit, OnModuleDestroy {
  constructor(
    private readonly requestService: RequestService,
    private readonly config: ConfigService,
  ) { }

  async onModuleInit() { }
  async onModuleDestroy() { }

  async send(event: any): Promise<AxiosResponse | Error> {
    const url = this.config.getLegalEventsUrl();
    return await this.requestService.post(`${url}/event-chains`, event);
  }
}
