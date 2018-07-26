import { Test } from '@nestjs/testing';
import { QueuerModuleConfig } from './queuer.module';
import { QueuerController } from './queuer.controller';
import { QueuerService } from './queuer.service';

describe('QueuerController', () => {
  let queuerController: QueuerController;
  let queuerService: QueuerService;

  beforeEach(async () => {
    const module = await Test.createTestingModule(QueuerModuleConfig).compile();
    module.init();

    queuerService = module.get<QueuerService>(QueuerService);
    queuerController = module.get<QueuerController>(QueuerController);
  });

  describe('add', () => {
    test('should add an event to the queue', async () => {
      const result = { name: 'foo' };
      jest.spyOn(queuerService, 'info').mockImplementation(() => result);
      expect(await queuerController.info()).toBe(result);
    });
  });
});
