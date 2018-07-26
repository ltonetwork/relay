import { Test } from '@nestjs/testing';
import { HttpService } from '@nestjs/common';
import { LegalEventsModuleConfig } from './legalevents.module';
import { LegalEventsService } from './legalevents.service';

describe('LegalEventsService', () => {
  let legalEventsService: LegalEventsService;
  let httpService: HttpService;

  beforeEach(async () => {
    const module = await Test.createTestingModule(LegalEventsModuleConfig).compile();
    await module.init();

    legalEventsService = module.get<LegalEventsService>(LegalEventsService);
    httpService = module.get<HttpService>(HttpService);
  });

  describe('send()', () => {
    test('should send an event to LegalEvents', async () => {
      const response = { status: 200, data: { bar: 'crux' } };
      const httpServiceSpy = jest.spyOn(httpService, 'post').mockImplementation(() => ({
        toPromise: () => Promise.resolve(response),
      }));

      const event = { foo: 'bar' };
      expect(await legalEventsService.send(event)).toBe(response);

      expect(httpServiceSpy.mock.calls.length).toBe(1);
      expect(httpServiceSpy.mock.calls[0][0]).toBe('http://localhost:3030/api/events');
      expect(httpServiceSpy.mock.calls[0][1]).toBe(event);
    });
  });
});
