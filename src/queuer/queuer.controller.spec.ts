// noinspection DuplicatedCode

import { Test, TestingModule } from '@nestjs/testing';
import request from 'supertest';
import { QueuerService } from './queuer.service';
import { INestApplication } from '@nestjs/common';
import { QueuerController } from './queuer.controller';
import { Account, AccountFactoryED25519, Message } from '@ltonetwork/lto';
import { LoggerService } from '../common/logger/logger.service';
import * as bodyParser from 'body-parser';
import { ConfigModule } from '../common/config/config.module';

describe('QueuerController', () => {
  let module: TestingModule;
  let loggerService: LoggerService;
  let queuerService: QueuerService;
  let app: INestApplication;

  let sender: Account;
  let recipient: Account;
  let message: Message;

  beforeEach(async () => {
    module = await Test.createTestingModule({
      imports: [ConfigModule],
      controllers: [QueuerController],
      providers: [
        { provide: LoggerService, useValue: { error: jest.fn(), debug: jest.fn() } },
        { provide: QueuerService, useValue: { add: jest.fn() } },
      ],
    }).compile();

    app = module.createNestApplication({ bodyParser: false });
    app.use(bodyParser.json({ limit: '128mb' }));
    app.use(bodyParser.raw({ type: 'application/octet-stream', limit: '128mb' }));

    await app.init();

    loggerService = module.get<LoggerService>(LoggerService);
    queuerService = module.get<QueuerService>(QueuerService);
  });

  afterEach(async () => {
    await module.close();
  });

  beforeEach(() => {
    const factory = new AccountFactoryED25519('T');
    sender = factory.createFromSeed('sender');
    recipient = factory.createFromSeed('recipient');
    message = new Message('hello').to(recipient).signWith(sender);
  });

  describe('POST /', () => {
    test('with JSON message', async () => {
      const res = await request(app.getHttpServer())
        .post('/')
        .set('Content-Type', 'application/json')
        .send(JSON.stringify(message));

      expect(res.status).toBe(204);

      expect(queuerService.add).toBeCalled();
      const queuedMessage = (queuerService.add as jest.Mock).mock.calls[0][0];
      expect(queuedMessage).toBeInstanceOf(Message);
      expect(queuedMessage.toJSON()).toEqual(queuedMessage.toJSON());
    });

    test('with binary message', async () => {
      const res = await request(app.getHttpServer())
        .post('/')
        .set('Content-Type', 'application/octet-stream')
        .send(Buffer.from(message.toBinary()));

      expect(res.status).toBe(204);

      expect(queuerService.add).toBeCalled();
      const queuedMessage = (queuerService.add as jest.Mock).mock.calls[0][0];
      expect(queuedMessage).toBeInstanceOf(Message);
      expect(queuedMessage.toJSON()).toEqual(queuedMessage.toJSON());
    });

    test('with invalid message', async () => {
      const res = await request(app.getHttpServer())
        .post('/')
        .set('Content-Type', 'application/json')
        .send('{}');

      expect(res.status).toBe(400);

      expect(queuerService.add).not.toBeCalled();
    });
  });
});
