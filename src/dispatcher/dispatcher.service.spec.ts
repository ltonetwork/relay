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
      });

      expect(rabbitmqConnection.consume.mock.calls.length).toBe(1);
      expect(rabbitmqConnection.consume.mock.calls[0][0]).toBe('default');
      expect(typeof rabbitmqConnection.consume.mock.calls[0][1]).toBe('function');
    });
  });
});
