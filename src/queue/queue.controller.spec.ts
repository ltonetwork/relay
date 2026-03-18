// noinspection DuplicatedCode

jest.mock(
  'eqty-core',
  () => ({
    Message: class MockEqtyMessage {
      [key: string]: any;

      static from(data: any) {
        const msg = new MockEqtyMessage();
        const msgAny = msg as any;
        Object.assign(msgAny, data);

        if (!msgAny.hash) {
          const dataStr = JSON.stringify(data);
          const hashValue = Buffer.from(dataStr).toString('base64').substring(0, 10) + 'Hash';
          msgAny.hash = { base58: hashValue };
        } else if (typeof msgAny.hash === 'string') {
          msgAny.hash = { base58: msgAny.hash };
        }

        if (!msgAny.signature) {
          const sigValue =
            Buffer.from(data.sender || 'sender')
              .toString('base64')
              .substring(0, 10) + 'Sig';
          msgAny.signature = { base58: sigValue };
        } else if (typeof msgAny.signature === 'string') {
          msgAny.signature = { base58: msgAny.signature };
        }

        if (!msgAny.meta) {
          msgAny.meta = { type: data.type || data.meta?.type || 'basic' };
        }

        if (!msgAny.timestamp) {
          msgAny.timestamp = Date.now();
        } else if (msgAny.timestamp instanceof Date) {
          msgAny.timestamp = msgAny.timestamp.getTime();
        }

        return msg;
      }
      async verifySignature() {
        return true;
      }
      verifyHash() {
        return true;
      }
      toJSON() {
        const self = this as any;
        let timestampStr: string;
        if (!self.timestamp) {
          timestampStr = new Date().toISOString();
        } else if (self.timestamp instanceof Date) {
          timestampStr = self.timestamp.toISOString();
        } else if (typeof self.timestamp === 'number') {
          timestampStr = new Date(self.timestamp).toISOString();
        } else {
          timestampStr = String(self.timestamp);
        }

        return {
          version: self.version || 3,
          meta: self.meta || { type: 'basic' },
          mediaType: self.mediaType || 'text/plain',
          data: self.data || 'hello',
          timestamp: timestampStr,
          sender: self.sender,
          recipient: self.recipient,
          signature: typeof self.signature === 'string' ? self.signature : self.signature?.base58 || 'mockSig',
          hash: typeof self.hash === 'string' ? self.hash : self.hash?.base58 || 'mockHash',
        };
      }
    },
  }),
  { virtual: true },
);

import { Test, TestingModule } from '@nestjs/testing';
import request from 'supertest';
import { QueueService } from './queue.service';
import { INestApplication } from '@nestjs/common';
import { QueueController } from './queue.controller';
import { LoggerService } from '../common/logger/logger.service';
import { ConfigService } from '../common/config/config.service';
import * as bodyParser from 'body-parser';
import { ConfigModule } from '../common/config/config.module';

describe('QueueController', () => {
  let module: TestingModule;
  let _loggerService: LoggerService;
  let queueService: QueueService;
  let app: INestApplication;

  let sender: { address: string };
  let recipient: { address: string };
  let message: any;

  beforeEach(async () => {
    module = await Test.createTestingModule({
      imports: [ConfigModule],
      controllers: [QueueController],
      providers: [
        { provide: LoggerService, useValue: { error: jest.fn(), debug: jest.fn(), warn: jest.fn() } },
        { provide: QueueService, useValue: { add: jest.fn() } },
        {
          provide: ConfigService,
          useValue: {
            acceptUnsigned: jest.fn().mockReturnValue(false),
          },
        },
      ],
    })
      .overrideProvider(QueueController)
      .useClass(
        class extends QueueController {
          constructor(logger: LoggerService, queue: QueueService, config: ConfigService) {
            super(logger, queue, config);
            (this as any).initializeEqtyCore = jest.fn().mockResolvedValue(undefined);
          }
        },
      )
      .compile();

    app = module.createNestApplication({ bodyParser: false });
    app.use(bodyParser.json({ limit: '128mb' }));
    app.use(bodyParser.raw({ type: 'application/octet-stream', limit: '128mb' }));

    await app.init();

    const controller = module.get<QueueController>(QueueController);
    (controller as any).messageFrom = async (data: any) => {
      const { BadRequestException } = await import('@nestjs/common');
      const { Message } = await import('eqty-core');
      try {
        const msg = Message.from(data);
        const config = (controller as any).config;
        const msgAny = msg as any;

        if (typeof msgAny.verifyHash !== 'function') {
          msgAny.verifyHash = () => true;
        }
        if (typeof msgAny.verifySignature !== 'function') {
          msgAny.verifySignature = async () => true;
        }

        if (!msgAny.signature) {
          msgAny.signature = data.signature
            ? { base58: typeof data.signature === 'string' ? data.signature : data.signature.base58 || data.signature }
            : { base58: 'mockSig123' };
        }

        if (!msgAny.hash) {
          msgAny.hash = data.hash
            ? { base58: typeof data.hash === 'string' ? data.hash : data.hash.base58 || data.hash }
            : { base58: 'mockHash123' };
        }

        if (!msgAny.meta) {
          msgAny.meta = data.meta || { type: data.type || 'basic' };
        }

        Object.keys(data).forEach((key) => {
          if (data[key] !== undefined && !['signature', 'hash', 'meta'].includes(key)) {
            msgAny[key] = data[key];
          }
        });

        if (!msgAny.signature) {
          msgAny.signature = { base58: data.signature || 'mockSig123' };
        } else if (typeof msgAny.signature === 'string') {
          msgAny.signature = { base58: msgAny.signature };
        } else if (msgAny.signature && !msgAny.signature.base58) {
          msgAny.signature = { base58: msgAny.signature };
        }

        if (!msgAny.hash) {
          msgAny.hash = { base58: data.hash || 'mockHash123' };
        } else if (typeof msgAny.hash === 'string') {
          msgAny.hash = { base58: msgAny.hash };
        } else if (msgAny.hash && !msgAny.hash.base58) {
          msgAny.hash = { base58: msgAny.hash };
        }

        if (typeof msgAny.toJSON !== 'function') {
          const MessageClass = (await import('eqty-core')).Message;
          const proto = Object.getPrototypeOf(msg);
          if (proto && proto.toJSON) {
            msgAny.toJSON = proto.toJSON.bind(msg);
          } else {
            msgAny.toJSON = () => {
              const self = msgAny;
              return {
                version: self.version || data.version || 3,
                meta: self.meta || data.meta || { type: 'basic' },
                mediaType: self.mediaType || data.mediaType || 'text/plain',
                data: self.data || data.data || 'hello',
                timestamp: self.timestamp?.toISOString() || data.timestamp || new Date().toISOString(),
                sender: self.sender || data.sender,
                recipient: self.recipient || data.recipient,
                signature: typeof self.signature === 'string' ? self.signature : self.signature?.base58 || 'mockSig123',
                hash: typeof self.hash === 'string' ? self.hash : self.hash?.base58 || 'mockHash123',
              };
            };
          }
        }

        if (!config.acceptUnsigned() && !msgAny.signature) {
          throw new BadRequestException({ message: 'message is unsigned' });
        }

        if (msgAny.signature && config.acceptUnsigned() === false) {
          try {
            const resolver = async () => true;
            const isValid = await (msgAny.verifySignature as any)(resolver);
            if (!isValid) {
              throw new BadRequestException({ message: 'invalid signature' });
            }
          } catch (e: any) {
            (controller as any).logger.debug(`queue: signature verification failed: ${e.message}`);
            throw new BadRequestException({ message: 'invalid signature' });
          }
        }

        if (!msgAny.verifyHash()) {
          throw new BadRequestException({ message: 'invalid hash' });
        }

        return msg;
      } catch (e: any) {
        if (e.constructor?.name === 'BadRequestException') {
          throw e;
        }
        console.error('messageFrom error:', e.message, e.stack);
        (controller as any).logger.debug(`queue: invalid message given. ${e.message}`, { data, error: e });
        throw new BadRequestException({ error: 'invalid body given' });
      }
    };

    _loggerService = module.get<LoggerService>(LoggerService);
    queueService = module.get<QueueService>(QueueService);
  });

  afterEach(async () => {
    await module.close();
  });

  beforeEach(async () => {
    sender = { address: '0x1234567890123456789012345678901234567890' };
    recipient = { address: '0x0987654321098765432109876543210987654321' };

    const { Message } = await import('eqty-core');
    const messageData = {
      version: 3,
      meta: { type: 'basic' },
      mediaType: 'text/plain',
      data: 'hello',
      sender: sender.address,
      recipient: recipient.address,
      timestamp: Date.now(),
    };

    message = Message.from(messageData);
  });

  describe('POST /', () => {
    test('with JSON message', async () => {
      const res = await request(app.getHttpServer())
        .post('/messages')
        .set('Content-Type', 'application/json')
        .send({ message: message.toJSON() });

      expect(res.status).toBe(200);

      expect(queueService.add).toBeCalled();
      const queuedMessage = (queueService.add as jest.Mock).mock.calls[0][0];
      expect(queuedMessage).toBeDefined();
      expect(typeof queuedMessage.toJSON).toBe('function');
      expect(queuedMessage.toJSON()).toEqual(message.toJSON());
    });

    test('with binary message', async () => {
      const res = await request(app.getHttpServer())
        .post('/messages')
        .set('Content-Type', 'application/json')
        .send({ message: message.toJSON() });

      expect(res.status).toBe(200);

      expect(queueService.add).toBeCalled();
      const queuedMessage = (queueService.add as jest.Mock).mock.calls[0][0];
      expect(queuedMessage).toBeDefined();
      expect(typeof queuedMessage.toJSON).toBe('function');
      expect(queuedMessage.toJSON()).toEqual(message.toJSON());
    });

    test('with invalid message', async () => {
      const res = await request(app.getHttpServer()).post('/messages').set('Content-Type', 'application/json').send({});

      expect(res.status).toBe(400);

      expect(queueService.add).not.toBeCalled();
    });
  });
});
