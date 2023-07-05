// noinspection DuplicatedCode

import { Test, TestingModule } from '@nestjs/testing';
import { DispatcherService } from './dispatcher.service';
import { RabbitMQService } from '../rabbitmq/rabbitmq.service';
import { ConfigModule } from '../common/config/config.module';
import { LtoIndexService } from '../common/lto-index/lto-index.service';
import { RequestService } from '../common/request/request.service';
import { LoggerService } from '../common/logger/logger.service';
import { Account, Message, AccountFactoryED25519, Binary } from '@ltonetwork/lto';
import { ConfigService } from '../common/config/config.service';
import { RabbitMQConnection } from '../rabbitmq/classes/rabbitmq.connection';
import { StorageService } from '../storage/storage.service';

describe('DispatcherService', () => {
  let module: TestingModule;
  let dispatcherService: DispatcherService;
  let configService: ConfigService;

  let spies: {
    rmqConnection: jest.Mocked<RabbitMQConnection>;
    rmqService: jest.Mocked<RabbitMQService>;
    storageService: jest.Mocked<StorageService>;
    ltoIndexService: jest.Mocked<LtoIndexService>;
    requestService: jest.Mocked<RequestService>;
    loggerService: jest.Mocked<LoggerService>;
  };

  let sender: Account;
  let recipient: Account;
  let message: Message;
  let ampqMsg: any;

  beforeEach(() => {
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

    const storageService = {
      store: jest.fn().mockResolvedValue(undefined),
    } as any;

    const ltoIndexService = {
      verifyAnchor: jest.fn(),
    } as any;

    const requestService = {
      post: jest.fn(),
    } as any;

    const loggerService = {
      debug: jest.fn(),
      info: jest.fn(),
      warn: jest.fn(),
    } as any;

    spies = { rmqConnection, rmqService, storageService, ltoIndexService, requestService, loggerService };
  });

  beforeEach(async () => {
    module = await Test.createTestingModule({
      imports: [ConfigModule],
      providers: [
        DispatcherService,
        { provide: RabbitMQService, useValue: spies.rmqService },
        { provide: StorageService, useValue: spies.storageService },
        { provide: LtoIndexService, useValue: spies.ltoIndexService },
        { provide: RequestService, useValue: spies.requestService },
        { provide: LoggerService, useValue: spies.loggerService },
      ]
    }).compile();
    await module.init();

    dispatcherService = module.get<DispatcherService>(DispatcherService);
    configService = module.get<ConfigService>(ConfigService);
  });

  afterEach(async () => {
    jest.restoreAllMocks();
    await module.close();
  });

  beforeEach(() => {
    const factory = new AccountFactoryED25519('T');
    sender = factory.createFromSeed('sender');
    recipient = factory.createFromSeed('recipient');
    message = new Message('hello').to(recipient).signWith(sender);
  });

  beforeEach(() => {
    ampqMsg = {
      content: { toString: () => JSON.stringify(message) },
      properties: {
        contentType: 'application/json',
        appId: 'lto-relay',
        messageId: message.hash.base58,
        type: message.type,
      },
    };
  });

  describe('start()', () => {
    test('should start the dispatcher which listens for rabbitmq messages', async () => {
      expect(spies.rmqService.connect.mock.calls.length).toBe(1);
      expect(spies.rmqService.connect.mock.calls[0][0]).toBe('amqp://');

      expect(spies.rmqConnection.consume.mock.calls.length).toBe(1);
      expect(spies.rmqConnection.consume.mock.calls[0][0]).toBe("amq.direct");
      expect(spies.rmqConnection.consume.mock.calls[0][1]).toBe('default');
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
        `dispatcher: message ${message.hash.base58} rejected, invalid app id`
      );
    });

    test('should reject if message has a type mismatch', async () => {
      ampqMsg.properties.type = 'foo';

      await dispatcherService.onMessage(ampqMsg);

      expect(spies.rmqConnection.reject).toHaveBeenCalledWith(ampqMsg);
      expect(spies.loggerService.warn).toHaveBeenCalledWith(
        `dispatcher: message ${message.hash.base58} rejected, type does not match message type`
      );
    });

    test('should reject if hash does not match message id', async () => {
      ampqMsg.properties.messageId = 'foo';

      await dispatcherService.onMessage(ampqMsg);

      expect(spies.rmqConnection.reject).toHaveBeenCalledWith(ampqMsg);
      expect(spies.loggerService.warn).toHaveBeenCalledWith(
        `dispatcher: message foo rejected, hash does not match message id`
      );
    });

    test('should reject if the recipient is not accepted', async () => {
      jest.spyOn(configService, 'isAcceptedAccount').mockReturnValue(false);

      await dispatcherService.onMessage(ampqMsg);

      expect(spies.rmqConnection.reject).toHaveBeenCalledWith(ampqMsg);
      expect(spies.loggerService.warn).toHaveBeenCalledWith(
        `dispatcher: message ${message.hash.base58} rejected, recipient is not accepted`
      );
    });

    test('should reject if message signature is invalid', async () => {
      message.signature = sender.sign('');

      await dispatcherService.onMessage(ampqMsg);

      expect(spies.rmqConnection.reject).toHaveBeenCalledWith(ampqMsg);
      expect(spies.loggerService.warn).toHaveBeenCalledWith(
        `dispatcher: message ${message.hash.base58} rejected, invalid signature`
      );
    });
  });

  describe('verify anchor', () => {
    it('will not verify if disabled',async () => {
      jest.spyOn(configService, 'verifyAnchorOnDispatch').mockReturnValue(false);

      const success = await dispatcherService.onMessage(ampqMsg);
      expect(success).toBe(true);

      expect(spies.ltoIndexService.verifyAnchor).not.toHaveBeenCalled();
    });

    it('will verify if enabled',async () => {
      jest.spyOn(configService, 'verifyAnchorOnDispatch').mockReturnValue(true);
      spies.ltoIndexService.verifyAnchor.mockResolvedValue(true);

      const success = await dispatcherService.onMessage(ampqMsg);
      expect(success).toBe(true);

      expect(spies.ltoIndexService.verifyAnchor).toHaveBeenCalledWith('T', message.hash);
    });

    it(`will retry the message if the anchor can't be verified`,async () => {
      jest.spyOn(configService, 'verifyAnchorOnDispatch').mockReturnValue(true);
      spies.ltoIndexService.verifyAnchor.mockResolvedValue(false);

      const success = await dispatcherService.onMessage(ampqMsg);
      expect(success).toBe(false);

      expect(spies.ltoIndexService.verifyAnchor).toHaveBeenCalledWith('T', message.hash);

      expect(spies.rmqConnection.retry).toHaveBeenCalledWith(ampqMsg);
      expect(spies.loggerService.warn).toHaveBeenCalledWith(
        `dispatcher: message ${message.hash.base58} requeued, not anchored`
      );
    });
  });

  describe('dispatch', () => {
    beforeEach(() => {
      jest.spyOn(configService, 'getDispatchTarget').mockReturnValue('https://example.com');
    });

    it('should POST the contents to the dispatch target',async () => {
      spies.requestService.post.mockResolvedValue({ status: 200 } as any);

      const success = await dispatcherService.onMessage(ampqMsg);
      expect(success).toBe(true);

      const [ url, data, options ] = spies.requestService.post.mock.calls[0];

      expect(url).toBe('https://example.com');
      expect(data).toBeInstanceOf(Binary);
      expect(data.toString()).toBe(message.data.toString());
      expect(options.headers).toEqual({
        'Content-Type': 'text/plain',
        'LTO-Message-Type': 'message',
        'LTO-Message-Sender': sender.address,
        'LTO-Message-SenderKeyType': 'ed25519',
        'LTO-Message-SenderPublicKey': sender.publicKey,
        'LTO-Message-Recipient': recipient.address,
        'LTO-Message-Signature': message.signature.base58,
        'LTO-Message-Timestamp': message.timestamp.toString(),
        'LTO-Message-Hash': message.hash.base58,
      });

      expect(spies.loggerService.debug).toHaveBeenCalledWith(
        `dispatcher: message ${message.hash.base58} dispatched to https://example.com`
      );

      expect(spies.rmqConnection.ack).toHaveBeenCalledWith(ampqMsg);
      expect(spies.loggerService.info).toHaveBeenCalledWith(
        `dispatcher: message ${message.hash.base58} acknowledged`
      );
    });

    it('should reject the message if the dispatch target returns a 400 error',async () => {
      spies.requestService.post.mockResolvedValue({ status: 400 } as any);

      const success = await dispatcherService.onMessage(ampqMsg);
      expect(success).toBe(false);

      expect(spies.rmqConnection.reject).toHaveBeenCalledWith(ampqMsg);
      expect(spies.loggerService.warn).toHaveBeenCalledWith(
        `dispatcher: message ${message.hash.base58} rejected, POST https://example.com gave a 400 response`
      );
    });

    it('should retry the message if the dispatch target returns an error',async () => {
      spies.requestService.post.mockResolvedValue({ status: 500 } as any);

      const success = await dispatcherService.onMessage(ampqMsg);
      expect(success).toBe(false);

      expect(spies.rmqConnection.retry).toHaveBeenCalledWith(ampqMsg);
      expect(spies.loggerService.warn).toHaveBeenCalledWith(
        `dispatcher: message ${message.hash.base58} requeued, POST https://example.com gave a 500 response`
      );
    });
  });

  describe('store message', () => {
    it('should store a message if storage is enabled',async () => {
      jest.spyOn(configService, 'isStorageEnabled').mockReturnValue(true);

      const success = await dispatcherService.onMessage(ampqMsg);
      expect(success).toBe(true);

      expect(spies.storageService.store).toHaveBeenCalledWith(message);
    });

    it('should not store a message if storage is disabled',async () => {
      jest.spyOn(configService, 'isStorageEnabled').mockReturnValue(false);

      const success = await dispatcherService.onMessage(ampqMsg);
      expect(success).toBe(true);

      expect(spies.storageService.store).not.toHaveBeenCalled();
    });
  });

  describe('decode message', () => {
    it('should parse a JSON message', () => {
      const ampqMsg: any = {
        content: { toString: () => JSON.stringify(message) },
        properties: { contentType: 'application/json' },
      };

      const decoded: Message = (dispatcherService as any).decodeMessage(ampqMsg);

      expect(decoded.type).toEqual(message.type);
      expect(decoded.sender).toEqual(message.sender);
      expect(decoded.recipient).toEqual(message.recipient);
      expect(decoded.timestamp).toEqual(message.timestamp);
      expect(decoded.mediaType).toEqual(message.mediaType);
      expect(decoded.data).toEqual(message.data);
      expect(decoded.hash).toEqual(message.hash);
    });

    it('should parse a binary message', () => {
      const ampqMsg: any = {
        content: message.toBinary(),
        properties: { contentType: 'application/octet-stream' },
      };

      const decoded: Message = (dispatcherService as any).decodeMessage(ampqMsg);

      expect(decoded.type).toEqual(message.type);
      expect(decoded.sender).toEqual(message.sender);
      expect(decoded.recipient).toEqual(message.recipient);
      expect(decoded.timestamp).toEqual(message.timestamp);
      expect(decoded.mediaType).toEqual(message.mediaType);
      expect(decoded.data).toEqual(message.data);
      expect(decoded.hash).toEqual(message.hash);
    });

    it('should reject a message with an unknown content type',  async() => {
      ampqMsg.properties.contentType = 'text/plain';

      const success = await dispatcherService.onMessage(ampqMsg);
      expect(success).toBe(false);

      expect(spies.rmqConnection.reject).toHaveBeenCalledWith(ampqMsg);
      expect(spies.loggerService.warn).toHaveBeenCalledWith(
        `dispatcher: message ${message.hash.base58} rejected, content type is not supported`
      );
    });
  })
});
