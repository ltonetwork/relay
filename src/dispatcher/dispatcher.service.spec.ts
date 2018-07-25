import { Test } from '@nestjs/testing';
import { DispatcherModuleConfig } from './dispatcher.module';
import { DispatcherService } from './dispatcher.service';
import { RabbitMQService } from '../rabbitmq/rabbitmq.service';

describe('DispatcherService', () => {
  let dispatcherService: DispatcherService;
  let rabbitmqService: RabbitMQService;

  beforeEach(async () => {
    const module = await Test.createTestingModule(DispatcherModuleConfig).compile();
    await module.init();

    dispatcherService = module.get<DispatcherService>(DispatcherService);
    rabbitmqService = module.get<RabbitMQService>(RabbitMQService);
  });

  describe('start()', () => {
    test('should start the dispatcher which listens for rabbitmq messages', async () => {
      const rabbitmqConnection = { consume: jest.fn() };
      const rabbitmqServiceSpy = { connect: jest.spyOn(rabbitmqService, 'connect') };
      rabbitmqServiceSpy.connect.mockImplementation(() => rabbitmqConnection);

      await dispatcherService.start();

      expect(rabbitmqServiceSpy.connect.mock.calls.length).toBe(1);
      expect(rabbitmqServiceSpy.connect.mock.calls[0][0]).toEqual({
        hostname: 'localhost',
        password: 'guest',
        port: '5672',
        protocol: 'amqp',
        username: 'guest',
        vhost: '/',
      });

      expect(rabbitmqConnection.consume.mock.calls.length).toBe(1);
      expect(rabbitmqConnection.consume.mock.calls[0][0]).toBe('default');
      expect(typeof rabbitmqConnection.consume.mock.calls[0][1]).toBe('function');
    });
  });

  describe('onMessage()', () => {
    const event = { id: 'fake_id' };
    const message = {
      content: { toString: () => JSON.stringify(event) },
    };

    test('should throw error if no connection is created', async () => {
      await expect(dispatcherService.onMessage(null)).rejects
        .toThrow('dispatcher: unable to handle message, connection is not started');
    });

    test('should throw error if invalid message is received', async () => {
      const rabbitmqConnection = { reject: jest.fn(), consume: jest.fn() };
      const rabbitmqServiceSpy = { connect: jest.spyOn(rabbitmqService, 'connect') };
      rabbitmqServiceSpy.connect.mockImplementation(() => rabbitmqConnection);

      await dispatcherService.start();
      await expect(dispatcherService.onMessage(null)).rejects
        .toThrow('dispatcher: unable to handle message, invalid message received');
    });

    test('should reject message if event has no id', async () => {
      const rabbitmqConnection = { reject: jest.fn(), consume: jest.fn() };
      const rabbitmqServiceSpy = { connect: jest.spyOn(rabbitmqService, 'connect') };
      rabbitmqServiceSpy.connect.mockImplementation(() => rabbitmqConnection);

      const empty = { content: { toString: () => '{}' } } as any;

      await dispatcherService.start();
      await dispatcherService.onMessage(empty);

      expect(rabbitmqConnection.reject.mock.calls.length).toBe(1);
      expect(rabbitmqConnection.reject.mock.calls[0][0]).toBe(empty);
    });
  });
});
