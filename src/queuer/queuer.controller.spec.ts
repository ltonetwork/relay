import { Test } from '@nestjs/testing';
import request from 'supertest';
import { AppModuleConfig } from '../app.module';
import { QueuerModuleConfig } from './queuer.module';
import { QueuerController } from './queuer.controller';
import { QueuerService } from './queuer.service';
import { INestApplication } from '@nestjs/common';

describe('QueuerController', () => {
  let queuerController: QueuerController;
  let queuerService: QueuerService;
  let app: INestApplication;

  beforeEach(async () => {
    const module = await Test.createTestingModule(AppModuleConfig).compile();
    app = module.createNestApplication();
    await app.init();

    queuerService = module.get<QueuerService>(QueuerService);
    queuerController = module.get<QueuerController>(QueuerController);
  });

  describe('POST /queue', () => {
    test('should add event to the local default queue', async () => {
      const res = await request(app.getHttpServer()).post('/queue').send({});
      expect(res.status).toBe(200);
      expect(res.header['content-type']).toMatch(/json/);
      expect(res.body).toMatchObject({
        name: 'event-dispatcher',
      });
    });
  });
});
