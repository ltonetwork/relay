import { Test } from '@nestjs/testing';
import { RequestService } from '../request/request.service';
import { LegalEventsModuleConfig } from './legalevents.module';
import { LegalEventsService } from './legalevents.service';

describe('LegalEventsService', () => {
  let legalEventsService: LegalEventsService;
  let requestService: RequestService;

  beforeEach(async () => {
    const module = await Test.createTestingModule(LegalEventsModuleConfig).compile();
    await module.init();

    legalEventsService = module.get<LegalEventsService>(LegalEventsService);
    requestService = module.get<RequestService>(RequestService);
  });

  describe('send()', () => {
    test('should send an event to LegalEvents', async () => {
      const response = { status: 200, data: { bar: 'crux' } };
      const requestServiceSpy = jest.spyOn(requestService, 'post')
        .mockImplementation(() => Promise.resolve(response));

      const event = { foo: 'bar' };
      expect(await legalEventsService.send(event)).toBe(response);

      expect(requestServiceSpy.mock.calls.length).toBe(1);
      expect(requestServiceSpy.mock.calls[0][0]).toBe('http://localhost:3030/api/events');
      expect(requestServiceSpy.mock.calls[0][1]).toBe(event);
    });
  });
});
