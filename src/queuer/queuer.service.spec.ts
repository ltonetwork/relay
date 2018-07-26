import { Test } from '@nestjs/testing';
import { QueuerModuleConfig } from './queuer.module';
import { QueuerService } from './queuer.service';
import { RabbitMQService } from '../rabbitmq/rabbitmq.service';
import { RabbitMQApiService } from '../rabbitmq/rabbitmq-api.service';

describe('QueuerService', () => {
  let queuerService: QueuerService;
  let rabbitmqService: RabbitMQService;
  let rabbitmqApiService: RabbitMQApiService;

  function spy() {
    const rmqConnection = {
      publish: jest.fn(),
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
    const module = await Test.createTestingModule(QueuerModuleConfig).compile();
    await module.init();

    queuerService = module.get<QueuerService>(QueuerService);
    rabbitmqService = module.get<RabbitMQService>(RabbitMQService);
    rabbitmqApiService = module.get<RabbitMQApiService>(RabbitMQApiService);
  });

  describe('add()', () => {
    test('should connect and publish event to local default queue', async () => {
      const spies = spy();

      const event = { id: 'fake_id' };
      await queuerService.add(event);

      expect(spies.rmqService.connect.mock.calls.length).toBe(1);
      expect(spies.rmqService.connect.mock.calls[0][0]).toEqual({
        hostname: 'localhost',
        password: 'guest',
        port: '5672',
        protocol: 'amqp',
        username: 'guest',
        vhost: '/',
      });

      expect(spies.rmqConnection.publish.mock.calls.length).toBe(1);
      expect(spies.rmqConnection.publish.mock.calls[0][0]).toBe('\'\'');
      expect(spies.rmqConnection.publish.mock.calls[0][1]).toBe('\'\'');
      expect(spies.rmqConnection.publish.mock.calls[0][2]).toBe(event);
    });

    test('should create dynamic shovel and publish event to remote queue if param is given', async () => {
      const spies = spy();

      const event = { id: 'fake_id' };
      const destination = ['amqp://ext1', 'amqp://ext2'];
      await queuerService.add(event, destination);

      expect(spies.rmqService.connect.mock.calls.length).toBe(1);
      expect(spies.rmqService.connect.mock.calls[0][0]).toEqual({
        hostname: 'localhost',
        password: 'guest',
        port: '5672',
        protocol: 'amqp',
        username: 'guest',
        vhost: '/',
      });

      expect(spies.rmqApiService.addDynamicShovel.mock.calls.length).toBe(2);
      expect(spies.rmqApiService.addDynamicShovel.mock.calls[0][0]).toBe('amqp://ext1');
      expect(spies.rmqApiService.addDynamicShovel.mock.calls[0][1]).toBe('amqp://ext1');
      expect(spies.rmqApiService.addDynamicShovel.mock.calls[1][0]).toBe('amqp://ext2');
      expect(spies.rmqApiService.addDynamicShovel.mock.calls[1][1]).toBe('amqp://ext2');

      expect(spies.rmqConnection.publish.mock.calls.length).toBe(2);
      expect(spies.rmqConnection.publish.mock.calls[0][0]).toBe('\'\'');
      expect(spies.rmqConnection.publish.mock.calls[0][1]).toBe('amqp://ext1');
      expect(spies.rmqConnection.publish.mock.calls[0][2]).toBe(event);
      expect(spies.rmqConnection.publish.mock.calls[1][0]).toBe('\'\'');
      expect(spies.rmqConnection.publish.mock.calls[1][1]).toBe('amqp://ext2');
      expect(spies.rmqConnection.publish.mock.calls[1][2]).toBe(event);
    });
  });
});