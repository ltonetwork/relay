import { Test } from '@nestjs/testing';
import request from 'supertest';
import { AppModuleConfig } from '../src/app.module';
import { INestApplication } from '@nestjs/common';
import { Account, AccountFactoryED25519, Message } from '@ltonetwork/lto';
import { ConfigLoaderService } from '../src/common/config/config-loader.service';
import * as bodyParser from 'body-parser';

describe('Queuer e2e test', () => {
  let app: INestApplication;
  let config: ConfigLoaderService;

  let sender: Account;
  let recipient: Account;
  let message: Message;

  beforeAll(async () => {
    const module = await Test.createTestingModule(AppModuleConfig).compile();
    app = module.createNestApplication({ bodyParser: false });
    app.use(bodyParser.json({ limit: '128mb' }));
    app.use(bodyParser.raw({ type: 'application/octet-stream', limit: '128mb' }));

    await app.init();

    config = module.get<ConfigLoaderService>(ConfigLoaderService);
  });

  afterAll(async () => {
    await app.close();
  });

  beforeEach(() => {
    const factory = new AccountFactoryED25519('T');
    sender = factory.createFromSeed('sender');
    recipient = factory.createFromSeed('recipient');
    message = new Message('hello').to(recipient).signWith(sender);
  });

  describe('POST /queue', () => {
    it('should add chain to the queue for local node', async () => {
      const res = await request(app.getHttpServer()).post('/').send(message);
      expect(res.status).toBe(204);
    }, 10000);
  });
});
