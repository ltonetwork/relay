import { Test, TestingModule } from '@nestjs/testing';
import request from 'supertest';
import { QueuerModuleConfig } from './queuer.module';
import { QueuerService } from './queuer.service';
import { INestApplication } from '@nestjs/common';

describe('QueuerController', () => {
  let module: TestingModule;
  let queuerService: QueuerService;
  let app: INestApplication;

  function spy() {
    const qService = {
      add: jest.spyOn(queuerService, 'add').mockImplementation(() => Promise.resolve() ),
    };

    return { qService };
  }

  beforeEach(async () => {
    module = await Test.createTestingModule(QueuerModuleConfig).compile();
    app = module.createNestApplication();
    await app.init();

    queuerService = module.get<QueuerService>(QueuerService);
  });

  afterEach(async () => {
    await module.close();
  });

  describe('POST /queue', () => {
    test('should pass event to the queuer service', async () => {
      const spies = spy();

      const event = { id: 'fakeid' };
      const res = await request(app.getHttpServer()).post('/queue').send(event);

      expect(res.status).toBe(204);
      expect(res.header['content-type']).toBeUndefined();
      expect(res.body).toEqual({});

      expect(spies.qService.add.mock.calls.length).toBe(1);
      expect(spies.qService.add.mock.calls[0][0]).toEqual(event);
      expect(spies.qService.add.mock.calls[0][1]).toBeUndefined();
    });

    test('should pass event and remote nodes to the queuer service', async () => {
      const spies = spy();

      const event = { id: 'fakeid' };
      const to = ['amqp://ext1', 'amqp://ext2'];
      const res = await request(app.getHttpServer()).post('/queue').query({ to }).send(event);

      expect(res.status).toBe(204);
      expect(res.header['content-type']).toBeUndefined();
      expect(res.body).toEqual({});

      expect(spies.qService.add.mock.calls.length).toBe(1);
      expect(spies.qService.add.mock.calls[0][0]).toEqual(event);
      expect(spies.qService.add.mock.calls[0][1]).toEqual(to);
    });
  });
});
