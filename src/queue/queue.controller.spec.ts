// noinspection DuplicatedCode

import { Test, TestingModule } from '@nestjs/testing';
import request from 'supertest';
import { QueueService } from './queue.service';
import { INestApplication } from '@nestjs/common';
import { QueueController } from './queue.controller';
import { Account, AccountFactoryED25519 } from '@ltonetwork/lto/accounts';
import { Message } from '@ltonetwork/lto/messages';
import { LoggerService } from '../common/logger/logger.service';
import * as bodyParser from 'body-parser';
import { ConfigModule } from '../common/config/config.module';

describe('QueueController', () => {
  let module: TestingModule;
  let loggerService: LoggerService;
  let queueService: QueueService;
  let app: INestApplication;

  let sender: Account;
  let recipient: Account;
  let message: Message;

  beforeEach(async () => {
    module = await Test.createTestingModule({
      imports: [ConfigModule],
      controllers: [QueueController],
      providers: [
        { provide: LoggerService, useValue: { error: jest.fn(), debug: jest.fn() } },
        { provide: QueueService, useValue: { add: jest.fn() } },
      ],
    }).compile();

    app = module.createNestApplication({ bodyParser: false });
    app.use(bodyParser.json({ limit: '128mb' }));
    app.use(bodyParser.raw({ type: 'application/octet-stream', limit: '128mb' }));

    await app.init();

    loggerService = module.get<LoggerService>(LoggerService);
    queueService = module.get<QueueService>(QueueService);
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

      expect(queueService.add).toBeCalled();
      const queuedMessage = (queueService.add as jest.Mock).mock.calls[0][0];
      expect(queuedMessage).toBeInstanceOf(Message);
      expect(queuedMessage.toJSON()).toEqual(queuedMessage.toJSON());
    });

    test('with binary message', async () => {
      const res = await request(app.getHttpServer())
        .post('/')
        .set('Content-Type', 'application/octet-stream')
        .send(Buffer.from(message.toBinary()));

      expect(res.status).toBe(204);

      expect(queueService.add).toBeCalled();
      const queuedMessage = (queueService.add as jest.Mock).mock.calls[0][0];
      expect(queuedMessage).toBeInstanceOf(Message);
      expect(queuedMessage.toJSON()).toEqual(queuedMessage.toJSON());
    });

    test('with invalid message', async () => {
      const res = await request(app.getHttpServer()).post('/').set('Content-Type', 'application/json').send('{}');

      expect(res.status).toBe(400);

      expect(queueService.add).not.toBeCalled();
    });
  });
});
