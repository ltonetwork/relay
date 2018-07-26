import { Test } from '@nestjs/testing';
import { QueuerModuleConfig } from './queuer.module';
import { QueuerService } from './queuer.service';
import { RabbitMQService } from '../rabbitmq/rabbitmq.service';
import { LegalEventsService } from '../legalevents/legalevents.service';

describe('QueuerService', () => {
  let queuerService: QueuerService;
  let rabbitmqService: RabbitMQService;
  let legalEventsService: LegalEventsService;

  function spy() {
    const rmqConnection = {
      ack: jest.fn(),
      reject: jest.fn(),
      consume: jest.fn(),
    };
    const rmqService = {
      connect: jest.spyOn(rabbitmqService, 'connect').mockImplementation(() => rmqConnection),
    };
    const leService = {
      send: jest.spyOn(legalEventsService, 'send').mockImplementation(() => ({ status: 200 })),
    };

    return { rmqConnection, rmqService, leService };
  }

  beforeEach(async () => {
    const module = await Test.createTestingModule(QueuerModuleConfig).compile();
    await module.init();

    queuerService = module.get<QueuerService>(QueuerService);
    rabbitmqService = module.get<RabbitMQService>(RabbitMQService);
    legalEventsService = module.get<LegalEventsService>(LegalEventsService);
  });

  describe('start()', () => {
    test('should start the queuer which listens for rabbitmq messages', async () => {
      const spies = spy();

      await queuerService.start();

      expect(spies.rmqService.connect.mock.calls.length).toBe(1);
      expect(spies.rmqService.connect.mock.calls[0][0]).toEqual({
        hostname: 'localhost',
        password: 'guest',
        port: '5672',
        protocol: 'amqp',
        username: 'guest',
        vhost: '/',
      });

      expect(spies.rmqConnection.consume.mock.calls.length).toBe(1);
      expect(spies.rmqConnection.consume.mock.calls[0][0]).toBe('default');
      expect(typeof spies.rmqConnection.consume.mock.calls[0][1]).toBe('function');
    });
  });

  describe('onMessage()', () => {
    test('should throw error if no connection is created', async () => {
      await expect(queuerService.onMessage(null)).rejects
        .toThrow('queuer: unable to handle message, connection is not started');
    });

    test('should throw error if invalid message is received', async () => {
      const spies = spy();

      await queuerService.start();
      await expect(queuerService.onMessage(null)).rejects
        .toThrow('queuer: unable to handle message, invalid message received');
    });

    test('should reject message if event has no id', async () => {
      const spies = spy();

      const msg = { content: { toString: () => '{}' } } as any;

      await queuerService.start();
      await queuerService.onMessage(msg);

      expect(spies.rmqConnection.reject.mock.calls.length).toBe(1);
      expect(spies.rmqConnection.reject.mock.calls[0][0]).toBe(msg);
    });

    test('should reject message if legalevents responds with bad status code', async () => {
      const spies = spy();

      const msg = { content: { toString: () => '{"id": "fake_id"}' } } as any;

      spies.leService.send.mockImplementation(() => ({ status: 400 }));

      await queuerService.start();
      await queuerService.onMessage(msg);

      expect(spies.rmqConnection.reject.mock.calls.length).toBe(1);
      expect(spies.rmqConnection.reject.mock.calls[0][0]).toBe(msg);
      expect(spies.leService.send.mock.calls.length).toBe(1);
      expect(spies.leService.send.mock.calls[0][0]).toEqual({ id: 'fake_id' });
    });

    test('should acknowledge message if legalevents responds with success status code', async () => {
      const spies = spy();

      const msg = { content: { toString: () => '{"id": "fake_id"}' } } as any;

      await queuerService.start();
      await queuerService.onMessage(msg);

      expect(spies.rmqConnection.reject.mock.calls.length).toBe(0);
      expect(spies.rmqConnection.ack.mock.calls.length).toBe(1);
      expect(spies.rmqConnection.ack.mock.calls[0][0]).toBe(msg);
      expect(spies.leService.send.mock.calls.length).toBe(1);
      expect(spies.leService.send.mock.calls[0][0]).toEqual({ id: 'fake_id' });
    });
  });
});
