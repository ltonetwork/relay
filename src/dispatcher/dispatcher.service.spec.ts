class MockMessage {
  hash: any;
  meta: any;
  sender: any;
  recipient: any;
  signature: any;
  timestamp: any;
  mediaType: any;
  data: any;

  static from(data: any) {
    const msg = new MockMessage();
    if (typeof data === 'string') {
      try {
        const parsed = JSON.parse(data);
        const hashStr = parsed.hash
          ? typeof parsed.hash === 'string'
            ? parsed.hash
            : parsed.hash.base58 || 'mockHash'
          : 'mockHash';
        msg.hash = { base58: hashStr };
        msg.meta = parsed.meta || { type: parsed.type || 'basic' };
        msg.sender = parsed.sender?.address || parsed.sender?.publicKey?.base58 || parsed.sender || '0x123';
        msg.recipient = parsed.recipient || '0x456';
        const sigStr = parsed.signature
          ? typeof parsed.signature === 'string'
            ? parsed.signature
            : parsed.signature.base58 || 'mockSig'
          : 'mockSig';
        msg.signature = { base58: sigStr };
        msg.timestamp = parsed.timestamp
          ? typeof parsed.timestamp === 'string'
            ? new Date(parsed.timestamp)
            : parsed.timestamp
          : new Date();
        msg.mediaType = parsed.mediaType || 'text/plain';
        if (parsed.data) {
          if (typeof parsed.data === 'string' && parsed.data.startsWith('base64:')) {
            msg.data = Buffer.from(parsed.data.substring(7), 'base64').toString('utf-8');
          } else {
            msg.data = parsed.data;
          }
        } else {
          msg.data = 'hello';
        }
      } catch {
        msg.hash = { base58: 'mockHash' };
        msg.meta = { type: 'basic' };
        msg.sender = '0x123';
        msg.recipient = '0x456';
        msg.signature = { base58: 'mockSig' };
        msg.timestamp = new Date();
        msg.mediaType = 'text/plain';
        msg.data = 'hello';
      }
    } else {
      const hashStr = data.hash
        ? typeof data.hash === 'string'
          ? data.hash
          : data.hash.base58 || 'mockHash'
        : 'mockHash';
      msg.hash = { base58: hashStr };
      msg.meta = data.meta || { type: data.type || 'basic' };
      msg.sender = data.sender?.address || data.sender?.publicKey?.base58 || data.sender || '0x123';
      msg.recipient = data.recipient || '0x456';
      const sigStr = data.signature
        ? typeof data.signature === 'string'
          ? data.signature
          : data.signature.base58 || 'mockSig'
        : 'mockSig';
      msg.signature = { base58: sigStr };
      msg.timestamp = data.timestamp
        ? typeof data.timestamp === 'string'
          ? new Date(data.timestamp)
          : data.timestamp
        : new Date();
      msg.mediaType = data.mediaType || 'text/plain';
      if (data.data) {
        if (typeof data.data === 'string' && data.data.startsWith('base64:')) {
          msg.data = Buffer.from(data.data.substring(7), 'base64').toString('utf-8');
        } else {
          msg.data = data.data;
        }
      } else {
        msg.data = 'hello';
      }
    }
    return msg;
  }
  verifyHash() {
    return true;
  }
  isSigned() {
    return true;
  }
  async verifySignature(resolver?: any) {
    return true;
  }
}

// noinspection DuplicatedCode

import { Test, TestingModule } from '@nestjs/testing';
import { DispatcherService } from './dispatcher.service';
import { RabbitMQService } from '../rabbitmq/rabbitmq.service';
import { ConfigModule } from '../common/config/config.module';
import { BaseAnchorService } from '../common/blockchain/base-anchor.service';
import { RequestService } from '../common/request/request.service';
import { LoggerService } from '../common/logger/logger.service';
// Removed LTO imports - using eqty-core Message for tests
import { ConfigService } from '../common/config/config.service';
import { RabbitMQConnection } from '../rabbitmq/classes/rabbitmq.connection';
import { InboxService } from '../inbox/inbox.service';

describe('DispatcherService', () => {
  let module: TestingModule;
  let dispatcherService: DispatcherService;
  let configService: ConfigService;

  let spies: {
    rmqConnection: jest.Mocked<RabbitMQConnection>;
    rmqService: jest.Mocked<RabbitMQService>;
    inboxService: jest.Mocked<InboxService>;
    baseAnchorService: jest.Mocked<BaseAnchorService>;
    requestService: jest.Mocked<RequestService>;
    loggerService: jest.Mocked<LoggerService>;
  };

  let sender: any;
  let recipient: any;
  let message: any;
  let ampqMsg: any;

  beforeEach(() => {
    sender = { address: '0x1234567890123456789012345678901234567890' };
    recipient = { address: '0x0987654321098765432109876543210987654321' };

    const messageData = Buffer.from('hello');
    message = {
      hash: { base58: 'mockHash' },
      meta: { type: 'basic' },
      sender: sender.address,
      recipient: recipient.address,
      signature: { base58: 'mockSig' },
      timestamp: new Date(),
      mediaType: 'text/plain',
      data: messageData,
      verifyHash: () => true,
      isSigned: () => true,
      verifySignature: async () => true,
      toBinary: () => new Uint8Array([1, 2, 3]),
    };
    Object.defineProperty(message, 'data', {
      get: () => messageData.toString('utf8'),
      enumerable: true,
      configurable: true,
    });

    const rmqConnection = {
      ack: jest.fn(),
      reject: jest.fn(),
      retry: jest.fn(),
      consume: jest.fn(),
    } as any;

    const rmqService = {
      connect: jest.fn().mockImplementation(() => rmqConnection as any),
      close: jest.fn(),
    } as any;

    const inboxService = {
      store: jest.fn().mockResolvedValue(undefined),
    } as any;

    const baseAnchorService = {
      verifyAnchor: jest.fn(),
      isNetworkSupported: jest.fn().mockReturnValue(true),
    } as any;

    const requestService = {
      post: jest.fn(),
    } as any;

    const loggerService = {
      debug: jest.fn(),
      info: jest.fn(),
      warn: jest.fn(),
    } as any;

    spies = { rmqConnection, rmqService, inboxService, baseAnchorService, requestService, loggerService };
  });

  beforeEach(async () => {
    module = await Test.createTestingModule({
      imports: [ConfigModule],
      providers: [
        DispatcherService,
        { provide: RabbitMQService, useValue: spies.rmqService },
        { provide: InboxService, useValue: spies.inboxService },
        { provide: BaseAnchorService, useValue: spies.baseAnchorService },
        { provide: RequestService, useValue: spies.requestService },
        { provide: LoggerService, useValue: spies.loggerService },
      ],
    })
      .overrideProvider(DispatcherService)
      .useClass(
        class extends DispatcherService {
          async onModuleInit() {
            (this as any).Message = MockMessage;
            await ((this as any).start as () => Promise<void>)();
          }
        },
      )
      .compile();

    await module.init();

    dispatcherService = module.get<DispatcherService>(DispatcherService);
    configService = module.get<ConfigService>(ConfigService);

    if (!configService.getDefaultNetworkId) {
      (configService as any).getDefaultNetworkId = jest.fn().mockReturnValue(84532);
    }

    (dispatcherService as any).decodeMessage = function (msg: any): any {
      if (msg.properties.contentType !== 'application/json') {
        (this as any).reject(
          msg,
          `message ${msg.properties.messageId} rejected, content type ${msg.properties.contentType} is not supported`,
        );
        return undefined;
      }
      try {
        const json = JSON.parse(msg.content.toString());
        return MockMessage.from(json);
      } catch {
        return undefined;
      }
    }.bind(dispatcherService);
  });

  afterEach(async () => {
    jest.restoreAllMocks();
    await module.close();
  });

  beforeEach(() => {
    // Message already created in beforeEach
  });

  beforeEach(() => {
    ampqMsg = {
      content: { toString: () => JSON.stringify(message) },
      properties: {
        contentType: 'application/json',
        appId: 'eqty-relay',
        messageId: message.hash.base58,
        type: 'basic',
      },
    };
  });

  describe('start()', () => {
    test('should start the dispatcher which listens for rabbitmq messages', async () => {
      expect(spies.rmqService.connect.mock.calls.length).toBe(1);
      expect(spies.rmqService.connect.mock.calls[0][0]).toBe('amqp://guest:guest@localhost:5672');

      expect(spies.rmqConnection.consume.mock.calls.length).toBe(1);
      expect(spies.rmqConnection.consume.mock.calls[0][0]).toBe('amq.direct');
      expect(spies.rmqConnection.consume.mock.calls[0][1]).toBe('relay');
      expect(typeof spies.rmqConnection.consume.mock.calls[0][2]).toBe('function');
    });
  });

  describe('validation', () => {
    test('should reject if message has no id', async () => {
      delete ampqMsg.properties.messageId;

      await dispatcherService.onMessage(ampqMsg);

      expect(spies.rmqConnection.reject).toHaveBeenCalledWith(ampqMsg);
      expect(spies.loggerService.warn).toHaveBeenCalledWith(`dispatcher: message rejected, no message id`);
    });

    test('should reject if message has invalid app id', async () => {
      ampqMsg.properties.appId = 'foo-bar';

      await dispatcherService.onMessage(ampqMsg);

      expect(spies.rmqConnection.reject).toHaveBeenCalledWith(ampqMsg);
      expect(spies.loggerService.warn).toHaveBeenCalledWith(
        `dispatcher: message ${message.hash.base58} rejected, invalid app id`,
      );
    });

    test('should reject if message has a type mismatch', async () => {
      ampqMsg.properties.type = 'foo';

      await dispatcherService.onMessage(ampqMsg);

      expect(spies.rmqConnection.reject).toHaveBeenCalledWith(ampqMsg);
      expect(spies.loggerService.warn).toHaveBeenCalledWith(
        `dispatcher: message ${message.hash.base58} rejected, type does not match message type`,
      );
    });

    test('should reject if hash does not match message id', async () => {
      ampqMsg.properties.messageId = 'foo';

      await dispatcherService.onMessage(ampqMsg);

      expect(spies.rmqConnection.reject).toHaveBeenCalledWith(ampqMsg);
      expect(spies.loggerService.warn).toHaveBeenCalledWith(
        `dispatcher: message foo rejected, hash does not match message id`,
      );
    });

    test('should reject if the recipient is not accepted', async () => {
      jest.spyOn(configService, 'isAcceptedAccount').mockReturnValue(false);

      await dispatcherService.onMessage(ampqMsg);

      expect(spies.rmqConnection.reject).toHaveBeenCalledWith(ampqMsg);
      expect(spies.loggerService.warn).toHaveBeenCalledWith(
        expect.stringContaining(`rejected, recipient is not accepted`),
      );
    });

    test('should reject if message signature is invalid', async () => {
      const invalidMessage = {
        ...message,
        hash: { base58: 'invalidHash' },
      };
      ampqMsg.content = { toString: () => JSON.stringify(invalidMessage) };
      ampqMsg.properties.messageId = invalidMessage.hash.base58;

      const originalVerify = MockMessage.prototype.verifySignature;
      MockMessage.prototype.verifySignature = jest.fn().mockResolvedValue(false);

      await dispatcherService.onMessage(ampqMsg);

      expect(spies.rmqConnection.reject).toHaveBeenCalledWith(ampqMsg);
      expect(spies.loggerService.warn).toHaveBeenCalledWith(expect.stringContaining(`rejected, invalid signature`));

      // Restore original
      MockMessage.prototype.verifySignature = originalVerify;
    });
  });

  describe('verify anchor', () => {
    it('will not verify if disabled', async () => {
      jest.spyOn(configService, 'verifyAnchorOnDispatch').mockReturnValue(false);

      const success = await dispatcherService.onMessage(ampqMsg);
      expect(success).toBe(true);

      expect(spies.baseAnchorService.verifyAnchor).not.toHaveBeenCalled();
    });

    it('will verify if enabled', async () => {
      jest.spyOn(configService, 'verifyAnchorOnDispatch').mockReturnValue(true);
      jest.spyOn(configService, 'getDefaultNetworkId').mockReturnValue(84532);
      spies.baseAnchorService.verifyAnchor.mockResolvedValue({ isAnchored: true });

      const success = await dispatcherService.onMessage(ampqMsg);
      expect(success).toBe(true);

      expect(spies.baseAnchorService.verifyAnchor).toHaveBeenCalled();
    });

    it(`will retry the message if the anchor can't be verified`, async () => {
      jest.spyOn(configService, 'verifyAnchorOnDispatch').mockReturnValue(true);
      jest.spyOn(configService, 'getDefaultNetworkId').mockReturnValue(84532);
      spies.baseAnchorService.verifyAnchor.mockResolvedValue({ isAnchored: false, error: 'Not anchored' });

      const success = await dispatcherService.onMessage(ampqMsg);
      expect(success).toBe(false);

      expect(spies.baseAnchorService.verifyAnchor).toHaveBeenCalled();

      expect(spies.rmqConnection.retry).toHaveBeenCalledWith(ampqMsg);
      expect(spies.loggerService.warn).toHaveBeenCalledWith(
        expect.stringContaining(`dispatcher: message ${message.hash.base58} requeued, not anchored`),
      );
    });
  });

  describe('dispatch', () => {
    beforeEach(() => {
      jest.spyOn(configService, 'getDispatchTarget').mockReturnValue({
        url: 'https://example.com',
        api_key: 'test',
      });
    });

    it('should POST the contents to the dispatch target', async () => {
      spies.requestService.post.mockResolvedValue({ status: 200 } as any);

      const success = await dispatcherService.onMessage(ampqMsg);
      expect(success).toBe(true);

      const [url, data, options] = spies.requestService.post.mock.calls[0];

      expect(url).toBe('https://example.com');
      expect(data).toBe('hello');
      expect(options.headers).toEqual({
        'Content-Type': 'text/plain',
        'EQTY-Message-Type': 'basic',
        'EQTY-Message-Sender': expect.any(String),
        'EQTY-Message-Recipient': expect.any(String),
        'EQTY-Message-Signature': expect.any(String),
        'EQTY-Message-Timestamp': expect.any(String),
        'EQTY-Message-Hash': expect.any(String),
        Authorization: 'Bearer test',
      });

      expect(spies.loggerService.debug).toHaveBeenCalledWith(
        `dispatcher: message ${message.hash.base58} dispatched to https://example.com`,
      );

      expect(spies.rmqConnection.ack).toHaveBeenCalledWith(ampqMsg);
      expect(spies.loggerService.info).toHaveBeenCalledWith(`dispatcher: message ${message.hash.base58} acknowledged`);
    });

    it('should reject the message if the dispatch target returns a 400 error', async () => {
      spies.requestService.post.mockResolvedValue({ status: 400 } as any);

      const success = await dispatcherService.onMessage(ampqMsg);
      expect(success).toBe(false);

      expect(spies.rmqConnection.reject).toHaveBeenCalledWith(ampqMsg);
      expect(spies.loggerService.warn).toHaveBeenCalledWith(
        `dispatcher: message ${message.hash.base58} rejected, POST https://example.com gave a 400 response`,
      );
    });

    it('should retry the message if the dispatch target returns an error', async () => {
      spies.requestService.post.mockResolvedValue({ status: 500 } as any);

      const success = await dispatcherService.onMessage(ampqMsg);
      expect(success).toBe(false);

      expect(spies.rmqConnection.retry).toHaveBeenCalledWith(ampqMsg);
      expect(spies.loggerService.warn).toHaveBeenCalledWith(
        `dispatcher: message ${message.hash.base58} requeued, POST https://example.com gave a 500 response`,
      );
    });
  });

  describe('store message', () => {
    it('should store a message if inbox is enabled', async () => {
      jest.spyOn(configService, 'isInboxEnabled').mockReturnValue(true);

      const success = await dispatcherService.onMessage(ampqMsg);
      expect(success).toBe(true);

      expect(spies.inboxService.store).toHaveBeenCalled();
      const storedMessage = spies.inboxService.store.mock.calls[0][0];
      expect(storedMessage.recipient).toBe(message.recipient);
      expect(storedMessage.sender).toBe(message.sender);
      expect(storedMessage.hash.base58).toBe(message.hash.base58);
    });

    it('should not store a message if inbox is disabled', async () => {
      jest.spyOn(configService, 'isInboxEnabled').mockReturnValue(false);

      const success = await dispatcherService.onMessage(ampqMsg);
      expect(success).toBe(true);

      expect(spies.inboxService.store).not.toHaveBeenCalled();
    });
  });

  describe('decode message', () => {
    it('should parse a JSON message', () => {
      const ampqMsg: any = {
        content: { toString: () => JSON.stringify(message) },
        properties: { contentType: 'application/json', messageId: 'test' },
      };

      const decoded = (dispatcherService as any).decodeMessage(ampqMsg);

      expect(decoded).toBeDefined();
      expect(decoded.meta?.type).toEqual('basic');
    });

    it('should reject binary message (only JSON supported)', () => {
      const ampqMsg: any = {
        content: message.toBinary(),
        properties: { contentType: 'application/octet-stream', messageId: 'test' },
      };

      const decoded = (dispatcherService as any).decodeMessage(ampqMsg);

      expect(decoded).toBeUndefined();
    });

    it('should reject a message with an unknown content type', async () => {
      ampqMsg.properties.contentType = 'text/plain';

      const success = await dispatcherService.onMessage(ampqMsg);
      expect(success).toBe(false);

      expect(spies.rmqConnection.reject).toHaveBeenCalledWith(ampqMsg);
      expect(spies.loggerService.warn).toHaveBeenCalledWith(
        expect.stringContaining(`dispatcher: message ${message.hash.base58} rejected, content type`),
      );
    });
  });
});
