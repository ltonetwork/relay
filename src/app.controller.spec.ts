import { Test } from '@nestjs/testing';
import { AppController } from './app.controller';
import { AppService } from './app.service';
import { ConfigModule } from './config/config.module';

describe('AppController', () => {
  let appController: AppController;
  let appService: AppService;

  beforeEach(async () => {
    const module = await Test.createTestingModule({
      imports: [ConfigModule],
      controllers: [AppController],
      providers: [AppService],
    }).compile();

    appService = module.get<AppService>(AppService);
    appController = module.get<AppController>(AppController);
  });

  describe('info', () => {
    it('should return application info', async () => {
      const result = { name: 'foo' };
      jest.spyOn(appService, 'info').mockImplementation(() => result);
      expect(await appController.info()).toBe(result);
    });
  });
});
