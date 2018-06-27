import { Test } from '@nestjs/testing';
import { RabbitMQModuleConfig } from './rabbitmq.module';
import { RabbitMQService } from './rabbitmq.service';
import { RABBITMQ_CONNECTION } from '../constants';

describe('RabbitMQService', () => {
  let rabbitmqService: RabbitMQService;
  const channel = {
    close: jest.fn(),
    assertQueue: jest.fn(),
    sendToQueue: jest.fn(),
    consume: jest.fn((queue: string, callback: (data: any) => void) => {
      return callback({ content: Buffer.from('Some message') });
    }),
  };
  const connection = {
    close: jest.fn(),
    createChannel: jest.fn(() => channel),
  };

  beforeEach(async () => {
    const module = await Test.createTestingModule(RabbitMQModuleConfig)
      .overrideProvider(RABBITMQ_CONNECTION)
      .useValue(connection)
      .compile();

    rabbitmqService = module.get<RabbitMQService>(RabbitMQService);
  });

  describe('consume()', () => {
    test('should consume message from the channel and pass it back to callback', async () => {
      const callback = jest.fn();

      await rabbitmqService.consume('fake_queue', callback);

      expect(channel.consume.mock.calls.length).toBe(1);
      expect(channel.consume.mock.calls[0][0]).toBe('fake_queue');
      expect(typeof channel.consume.mock.calls[0][1]).toBe('function');

      expect(callback.mock.calls.length).toBe(1);
      expect(callback.mock.calls[0][0]).toBe('Some message');
    });
  });

  describe('produce()', () => {
    test('should produce message and send it to the channel', async () => {
      await rabbitmqService.produce('fake_queue', 'This is produced');
      expect(channel.sendToQueue.mock.calls.length).toBe(1);
      expect(channel.sendToQueue.mock.calls[0][0]).toBe('fake_queue');
      expect(channel.sendToQueue.mock.calls[0][1]).toEqual(Buffer.from(JSON.stringify('This is produced')));
    });
  });

  describe('close()', () => {
    test('should close connection and channel', async () => {
      await rabbitmqService.close();
      expect(connection.close.mock.calls.length).toBe(1);
      expect(channel.close.mock.calls.length).toBe(1);
    });
  });
});
