import request from 'supertest';
import { Test } from '@nestjs/testing';
import { AppModuleConfig } from '../src/app.module';
import { INestApplication } from '@nestjs/common';

describe('Application e2e test', () => {
  let app: INestApplication;

  beforeAll(async () => {
    const moduleFixture = await Test.createTestingModule(AppModuleConfig).compile();

    app = moduleFixture.createNestApplication();
    await app.init();
  });

  afterAll(async () => {
    await app.close();
  });

  describe('GET /', () => {
    test('should return application info', async () => {
      const res = await request(app.getHttpServer()).get('/');
      expect(res.status).toBe(200);
      expect(res.header['content-type']).toMatch(/json/);
      expect(res.body).toMatchObject({
        name: 'event-dispatcher',
        version: '0.0.1',
        description: 'Event dispatcher',
        env: 'test',
      });
    });
  });
});
