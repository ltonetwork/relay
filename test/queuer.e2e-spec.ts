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
    test('should add event to the queue for local node', async () => {
      const event = { id: 'local' };
      const res = await request(app.getHttpServer())
        .post('/queue')
        .send(event);

      expect(res.status).toBe(204);
      expect(res.header['content-type']).toBeUndefined();
      expect(res.body).toEqual({});
    }, 10000);

    test('should add event to the queue for remote node', async () => {
      const event = { id: 'external' };
      const to = 'amqp://';
      const res = await request(app.getHttpServer())
        .post('/queue')
        .query({ to })
        .send(event);

      expect(res.status).toBe(204);
      expect(res.header['content-type']).toBeUndefined();
      expect(res.body).toEqual({});
    }, 10000);
  });
});
