import { Test, TestingModule } from '@nestjs/testing';
import { QueuerModuleConfig } from './queuer.module';
import { QueuerService } from './queuer.service';
import { RabbitMQService } from '../rabbitmq/rabbitmq.service';
import { RabbitMQApiService } from '../rabbitmq/rabbitmq-api.service';
import { EventChain } from 'lto-api';

describe('QueuerService', () => {
  let module: TestingModule;
  let queuerService: QueuerService;
  let rabbitmqService: RabbitMQService;
  let rabbitmqApiService: RabbitMQApiService;

  function spy() {
    const rmqConnection = {
      publish: jest.fn(),
      init: jest.fn(),
    };
    const rmqService = {
      connect: jest.spyOn(rabbitmqService, 'connect').mockImplementation(() => rmqConnection),
    };
    const rmqApiService = {
      addDynamicShovel: jest.spyOn(rabbitmqApiService, 'addDynamicShovel').mockImplementation(() => ({ status: 200 })),
    };

    return { rmqConnection, rmqService, rmqApiService };
  }

  beforeEach(async () => {
    module = await Test.createTestingModule(QueuerModuleConfig).compile();
    await module.init();

    queuerService = module.get<QueuerService>(QueuerService);
    rabbitmqService = module.get<RabbitMQService>(RabbitMQService);
    rabbitmqApiService = module.get<RabbitMQApiService>(RabbitMQApiService);
  });

  afterEach(async () => {
    await module.close();
  });

  describe('add()', () => {
    test('should connect and publish event to local default queue', async () => {
      const spies = spy();

      const chain = { id: 'fakeid', events: [{ body: 'fakebody', signkey: 'fakesignkey' }] };
      await queuerService.add(chain);

      expect(spies.rmqService.connect.mock.calls.length).toBe(1);
      expect(spies.rmqService.connect.mock.calls[0][0]).toBe('amqp://');

      expect(spies.rmqConnection.init.mock.calls.length).toBe(0);

      expect(spies.rmqConnection.publish.mock.calls.length).toBe(1);
      expect(spies.rmqConnection.publish.mock.calls[0][0]).toBe('\'\'');
      expect(spies.rmqConnection.publish.mock.calls[0][1]).toBe('default');
      expect(spies.rmqConnection.publish.mock.calls[0][2]).toBeInstanceOf(EventChain);
      expect(spies.rmqConnection.publish.mock.calls[0][2]).toMatchObject({
        id: 'fakeid',
        events: [{ body: 'fakebody', origin: 'amqp://guest:guest@localhost:5672', signkey: 'fakesignkey' }],
      });
    });

    test('should create dynamic shovel and publish event to remote queue if param is given', async () => {
      const spies = spy();

      const chain = { id: 'fakeid', events: [{ body: 'fakebody', signkey: 'fakesignkey' }] };
      const destination = ['amqp://ext1', 'amqp://ext2'];
      await queuerService.add(chain, destination);

      expect(spies.rmqService.connect.mock.calls.length).toBe(1);
      expect(spies.rmqService.connect.mock.calls[0][0]).toBe('amqp://');

      expect(spies.rmqApiService.addDynamicShovel.mock.calls.length).toBe(2);
      expect(spies.rmqApiService.addDynamicShovel.mock.calls[0][0]).toBe('amqp://ext1');
      expect(spies.rmqApiService.addDynamicShovel.mock.calls[0][1]).toBe('amqp://ext1');
      expect(spies.rmqApiService.addDynamicShovel.mock.calls[1][0]).toBe('amqp://ext2');
      expect(spies.rmqApiService.addDynamicShovel.mock.calls[1][1]).toBe('amqp://ext2');

      expect(spies.rmqConnection.init.mock.calls.length).toBe(2);

      expect(spies.rmqConnection.publish.mock.calls.length).toBe(2);
      expect(spies.rmqConnection.publish.mock.calls[0][0]).toBe('\'\'');
      expect(spies.rmqConnection.publish.mock.calls[0][1]).toBe('amqp://ext1');
      expect(spies.rmqConnection.publish.mock.calls[0][2]).toBeInstanceOf(EventChain);
      expect(spies.rmqConnection.publish.mock.calls[0][2]).toMatchObject({
        id: 'fakeid',
        events: [{ body: 'fakebody', origin: 'amqp://guest:guest@localhost:5672', signkey: 'fakesignkey' }],
      });
      expect(spies.rmqConnection.publish.mock.calls[1][0]).toBe('\'\'');
      expect(spies.rmqConnection.publish.mock.calls[1][1]).toBe('amqp://ext2');
      expect(spies.rmqConnection.publish.mock.calls[1][2]).toBeInstanceOf(EventChain);
      expect(spies.rmqConnection.publish.mock.calls[1][2]).toMatchObject({
        id: 'fakeid',
        events: [{ body: 'fakebody', origin: 'amqp://guest:guest@localhost:5672', signkey: 'fakesignkey' }],
      });
    });
  });
});
