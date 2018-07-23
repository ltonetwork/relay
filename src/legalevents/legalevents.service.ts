import { Injectable, Inject, OnModuleInit, OnModuleDestroy, HttpService } from '@nestjs/common';

@Injectable()
export class LegalEventsService implements OnModuleInit, OnModuleDestroy {
  constructor(private readonly httpService: HttpService) { }

  async onModuleInit() { }

  async onModuleDestroy() { }

  async post() {
    const response = await this.httpService.get('http://example.com').toPromise();
    console.log(response);
  }
}
