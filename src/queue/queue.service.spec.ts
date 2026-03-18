// noinspection DuplicatedCode

import { Test, TestingModule } from '@nestjs/testing';
import { QueueService } from './queue.service';
import { ConfigModule } from '../common/config/config.module';
import { LoggerService } from '../common/logger/logger.service';
import { DidResolverService } from '../common/did-resolver/did-resolver.service';
import { RabbitMQApiService } from '../rabbitmq/rabbitmq-api.service';
import { RabbitMQService } from '../rabbitmq/rabbitmq.service';

describe('QueueService', () => {
  let module: TestingModule;
  let queueService: QueueService;

  let spies: {
    rmqConnection: {
      publish: jest.Mock;
      init: jest.Mock;
      checkQueue: jest.Mock;
    };
    rmqService: {
      connect: jest.Mock;
    };
    rmqApiService: {
      addDynamicShovel: jest.Mock;
    };
    resolver: {
      getServiceEndpoint: jest.Mock;
    };
    logger: {
      info: jest.Mock;
    };
  };

  let sender: { address: string };
  let recipient: { address: string };
  let message: any;

  beforeEach(() => {
    const rmqConnection = {
      publish: jest.fn(),
      init: jest.fn(),
      checkQueue: jest.fn().mockReturnValue(false),
    };
    const rmqService = {
      connect: jest.fn().mockImplementation(() => rmqConnection as any),
    };
    const rmqApiService = {
      addDynamicShovel: jest.fn().mockImplementation(() => ({ status: 200 } as any)),
    };
    const resolver = {
      getServiceEndpoint: jest.fn().mockImplementation(() => 'ampq://localhost'),
    };
    const logger = {
      info: jest.fn(),
    };

    spies = { rmqConnection, rmqService, rmqApiService, resolver, logger };
  });

  beforeEach(async () => {
    module = await Test.createTestingModule({
      imports: [ConfigModule],
      providers: [
        QueueService,
        { provide: RabbitMQService, useValue: spies.rmqService },
        { provide: RabbitMQApiService, useValue: spies.rmqApiService },
        { provide: DidResolverService, useValue: spies.resolver },
        { provide: LoggerService, useValue: spies.logger },
      ],
    })
      .overrideProvider(QueueService)
      .useClass(
        class extends QueueService {
          async onModuleInit() {
            const MockMessage = class {
              static from(data: any) {
                return data;
              }
            };
            (this as any)._Message = MockMessage;
            if (!(this as any).config.isQueueEnabled()) return;
            (this as any).connection = await (this as any).rabbitMQService.connect(
              (this as any).config.getRabbitMQClient(),
            );
          }
        },
      )
      .compile();
    await module.init();

    queueService = module.get<QueueService>(QueueService);
  });

  afterEach(async () => {
    jest.restoreAllMocks();
    await module.close();
  });

  beforeEach(() => {
    sender = { address: '0x1234567890123456789012345678901234567890' };
    recipient = { address: '0x0987654321098765432109876543210987654321' };

    message = {
      hash: { base58: 'mockHash123' },
      meta: { type: 'basic' },
      sender: sender.address,
      recipient: recipient.address,
      signature: { base58: 'mockSig123' },
      timestamp: new Date(),
      mediaType: 'text/plain',
      data: 'hello',
      version: 3,
      toJSON: () => ({
        version: 3,
        meta: { type: 'basic' },
        mediaType: 'text/plain',
        data: 'hello',
        timestamp: message.timestamp.toISOString(),
        sender: sender.address,
        recipient: recipient.address,
        signature: 'mockSig123',
        hash: 'mockHash123',
      }),
      verifyHash: () => true,
      isSigned: () => true,
      verifySignature: async () => true,
    };
  });

  describe('add()', () => {
    test('should connect and publish event to local default queue', async () => {
      await queueService.add(message);

      expect(spies.rmqConnection.publish).toBeCalledWith('amq.direct', 'relay', JSON.stringify(message.toJSON()), {
        appId: 'eqty-relay',
        messageId: message.hash.base58,
        type: 'basic',
        contentType: 'application/json',
      });
    });

    test('should create dynamic shovel and publish event to remote queue', async () => {
      spies.resolver.getServiceEndpoint.mockImplementationOnce(() => 'amqp://example.com');

      await queueService.add(message);

      expect(spies.resolver.getServiceEndpoint).toBeCalledWith(recipient.address);
      expect(spies.rmqApiService.addDynamicShovel).toBeCalledWith('amqp://example.com', 'amqp://example.com');

      expect(spies.rmqConnection.publish).toBeCalledWith(
        'amq.direct',
        'amqp://example.com',
        JSON.stringify(message.toJSON()),
        {
          appId: 'eqty-relay',
          messageId: message.hash.base58,
          type: 'basic',
          contentType: 'application/json',
        },
      );
    });

    test('should not create a shovel if the queue already exists', async () => {
      spies.resolver.getServiceEndpoint.mockImplementationOnce(() => 'amqp://example.com');
      spies.rmqConnection.checkQueue.mockReturnValueOnce({ messageCount: 0 });

      await queueService.add(message);

      expect(spies.resolver.getServiceEndpoint).toBeCalledWith(recipient.address);
      expect(spies.rmqApiService.addDynamicShovel).not.toBeCalled();

      expect(spies.rmqConnection.publish).toBeCalledWith(
        'amq.direct',
        'amqp://example.com',
        JSON.stringify(message.toJSON()),
        {
          appId: 'eqty-relay',
          messageId: message.hash.base58,
          type: 'basic',
          contentType: 'application/json',
        },
      );
    });
  });
});
