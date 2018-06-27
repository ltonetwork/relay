import { Test } from '@nestjs/testing';
import { RabbitMQModuleConfig } from './rabbitmq.module';
import { RabbitMQService } from './rabbitmq.service';
import { RABBITMQ_CONNECTION } from '../constants';

describe('RabbitMQService', () => {
  let rabbitmqService: RabbitMQService;
  const channel = {
    assertQueue: () => { },
    consume: (queue: string, callback: (data: any) => void) => {
      return callback({ content: Buffer.from('Some message') });
    },
  };
  const connection = {
    createChannel: () => channel,
  };

  beforeEach(async () => {
    const module = await Test.createTestingModule(RabbitMQModuleConfig)
      .overrideProvider(RABBITMQ_CONNECTION)
      .useValue(connection)
      .compile();

    rabbitmqService = module.get<RabbitMQService>(RabbitMQService);
  });

  describe('consume()', () => {
    test('should consume message and pass it back to callback', async () => {
      const callback = jest.fn();

      await rabbitmqService.consume('fake_queue', callback);

      expect(callback.mock.calls.length).toBe(1);
      expect(callback.mock.calls[0][0]).toBe('Some message');
    });
  });
});
