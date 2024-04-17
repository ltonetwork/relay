// noinspection DuplicatedCode

import { Test, TestingModule } from '@nestjs/testing';
import { QueueService } from './queue.service';
import { Message, Account, AccountFactoryED25519 } from '@ltonetwork/lto';
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

  let sender: Account;
  let recipient: Account;
  let message: Message;

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
    }).compile();
    await module.init();

    queueService = module.get<QueueService>(QueueService);
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

  describe('add()', () => {
    test('should connect and publish event to local default queue', async () => {
      await queueService.add(message);

      expect(spies.rmqConnection.publish).toBeCalledWith('amq.direct', 'default', message.toBinary(), {
        appId: 'lto-relay',
        messageId: message.hash.base58,
        type: 'basic',
      });
    });

    test('should create dynamic shovel and publish event to remote queue', async () => {
      spies.resolver.getServiceEndpoint.mockImplementationOnce(() => 'amqp://example.com');

      await queueService.add(message);

      expect(spies.resolver.getServiceEndpoint).toBeCalledWith(recipient.address);
      expect(spies.rmqApiService.addDynamicShovel).toBeCalledWith('amqp://example.com', 'amqp://example.com');

      expect(spies.rmqConnection.publish).toBeCalledWith('amq.direct', 'amqp://example.com', message.toBinary(), {
        appId: 'lto-relay',
        messageId: message.hash.base58,
        type: 'basic',
      });
    });

    test('should not create a shovel if the queue already exists', async () => {
      spies.resolver.getServiceEndpoint.mockImplementationOnce(() => 'amqp://example.com');
      spies.rmqConnection.checkQueue.mockReturnValueOnce({ messageCount: 0 });

      await queueService.add(message);

      expect(spies.resolver.getServiceEndpoint).toBeCalledWith(recipient.address);
      expect(spies.rmqApiService.addDynamicShovel).not.toBeCalled();

      expect(spies.rmqConnection.publish).toBeCalledWith('amq.direct', 'amqp://example.com', message.toBinary(), {
        appId: 'lto-relay',
        messageId: message.hash.base58,
        type: 'basic',
      });
    });
  });
});
