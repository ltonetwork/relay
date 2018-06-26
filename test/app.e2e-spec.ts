import request from 'supertest';
import { Test } from '@nestjs/testing';
import { AppModule } from './../src/app.module';
import { INestApplication } from '@nestjs/common';

describe('AppController (e2e)', () => {
  let app: INestApplication;

  beforeAll(async () => {
    const moduleFixture = await Test.createTestingModule({
      imports: [AppModule],
    }).compile();

    app = moduleFixture.createNestApplication();
    await app.init();
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
