import { Test } from '@nestjs/testing';
import request from 'supertest';
import { AppModuleConfig } from '../src/app.module';
import { INestApplication } from '@nestjs/common';

describe('Queuer e2e test', () => {
  let app: INestApplication;

  beforeAll(async () => {
    const module = await Test.createTestingModule(AppModuleConfig).compile();
    app = module.createNestApplication();
    await app.init();
  });

  afterAll(async () => {
    await app.close();
  });

  describe('POST /queue', () => {
    test('should add chain to the queue for local node', async () => {
      const chain = { id: 'fakeid1', events: [{ body: 'fakebody', signkey: 'fakesignkey' }] };
      const res = await request(app.getHttpServer())
        .post('/queue')
        .send(chain);

      expect(res.status).toBe(204);
      expect(res.header['content-type']).toBeUndefined();
      expect(res.body).toEqual({});
    }, 10000);

    test('should add chain to the queue for remote node', async () => {
      const chain = { id: 'fakeid2', events: [{ body: 'fakebody', signkey: 'fakesignkey' }] };
      const to = 'amqp://';
      const res = await request(app.getHttpServer())
        .post('/queue')
        .query({ to })
        .send(chain);

      expect(res.status).toBe(204);
      expect(res.header['content-type']).toBeUndefined();
      expect(res.body).toEqual({});
    }, 10000);
  });
});
