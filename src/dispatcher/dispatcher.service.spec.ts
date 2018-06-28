import { Test } from '@nestjs/testing';
import { DispatcherModuleConfig } from './dispatcher.module';
import { DispatcherService } from './dispatcher.service';

describe('DispatcherService', () => {
  let dispatcherService: DispatcherService;

  beforeEach(async () => {
    const module = await Test.createTestingModule(DispatcherModuleConfig).compile();

    dispatcherService = module.get<DispatcherService>(DispatcherService);
    await dispatcherService.onModuleInit();
  });

  afterEach(async () => {
    await dispatcherService.onModuleDestroy();
  });

  describe('start()', () => {
    test('should start the dispatcher which listens for rabbitmq messages', async () => {
    });
  });
});
