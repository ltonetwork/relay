import { Test } from '@nestjs/testing';
import { LegalEventsModuleConfig } from './legalevents.module';
import { LegalEventsService } from './legalevents.service';

describe('LegalEventsService', () => {
  let legalEventsService: LegalEventsService;

  beforeEach(async () => {
    const module = await Test.createTestingModule(LegalEventsModuleConfig).compile();
    await module.init();

    legalEventsService = module.get<LegalEventsService>(LegalEventsService);
  });

  describe('connect()', () => {
    test('should connect to LegalEvents and store the connection for reuse', async () => {
      const response = await legalEventsService.post();
      console.log(response);
    });
  });
});
