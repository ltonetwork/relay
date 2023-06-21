import { Test, TestingModule } from '@nestjs/testing';
import { DispatcherModuleConfig } from './dispatcher.module';
import { DispatcherService } from './dispatcher.service';
import { RabbitMQService } from '../rabbitmq/rabbitmq.service';

describe('DispatcherService', () => {
  let module: TestingModule;
  let dispatcherService: DispatcherService;
  let rabbitmqService: RabbitMQService;

  function spy() {
    const rmqConnection = {
      ack: jest.fn(),
      deadletter: jest.fn(),
      consume: jest.fn(),
    };
    const rmqService = {
      connect: jest.spyOn(rabbitmqService, 'connect').mockImplementation(() => rmqConnection as any),
    };

    return { rmqConnection, rmqService };
  }

  beforeEach(async () => {
    module = await Test.createTestingModule(DispatcherModuleConfig).compile();
    await module.init();

    dispatcherService = module.get<DispatcherService>(DispatcherService);
    rabbitmqService = module.get<RabbitMQService>(RabbitMQService);
  });

  afterEach(async () => {
    await module.close();
  });

  describe('start()', () => {
    test('should start the dispatcher which listens for rabbitmq messages', async () => {
      const spies = spy();

      await dispatcherService.start();

      expect(spies.rmqService.connect.mock.calls.length).toBe(1);
      expect(spies.rmqService.connect.mock.calls[0][0]).toBe('amqp://');

      expect(spies.rmqConnection.consume.mock.calls.length).toBe(1);
      expect(spies.rmqConnection.consume.mock.calls[0][0]).toBe("''");
      expect(spies.rmqConnection.consume.mock.calls[0][1]).toBe('default');
      expect(typeof spies.rmqConnection.consume.mock.calls[0][2]).toBe('function');
    });
  });

  describe('onMessage()', () => {
    test('should deadletter message if invalid or no message is received', async () => {
      const spies = spy();

      const msg = null;

      await dispatcherService.onMessage(msg);

      expect(spies.rmqConnection.deadletter.mock.calls.length).toBe(1);
      expect(spies.rmqConnection.deadletter.mock.calls[0][0]).toBe(msg);
    });

    test('should deadletter message if event has no id', async () => {
      const spies = spy();

      const msg = { content: { toString: () => '{}' } } as any;

      await dispatcherService.onMessage(msg);

      expect(spies.rmqConnection.deadletter.mock.calls.length).toBe(1);
      expect(spies.rmqConnection.deadletter.mock.calls[0][0]).toBe(msg);
    });

    test('should deadletter message if legalevents responds with bad status code', async () => {
      const spies = spy();

      const msg = { content: { toString: () => '{"id": "fakeid"}' } } as any;

      await dispatcherService.start();
      await dispatcherService.onMessage(msg);

      expect(spies.rmqConnection.deadletter.mock.calls.length).toBe(1);
      expect(spies.rmqConnection.deadletter.mock.calls[0][0]).toBe(msg);
    });

    test('should acknowledge message if legalevents responds with success status code', async () => {
      const spies = spy();

      const msg = { content: { toString: () => '{"id": "fakeid"}' } } as any;

      await dispatcherService.onMessage(msg);

      expect(spies.rmqConnection.deadletter.mock.calls.length).toBe(0);
      expect(spies.rmqConnection.ack.mock.calls.length).toBe(1);
      expect(spies.rmqConnection.ack.mock.calls[0][0]).toBe(msg);
    });
  });
});
