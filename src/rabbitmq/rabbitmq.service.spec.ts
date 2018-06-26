import { Test } from '@nestjs/testing';
import { rabbitmqProviders } from './rabbitmq.providers';
import { RabbitMQService } from './rabbitmq.service';
import { ConfigModule } from '../config/config.module';
import { RABBITMQ_CONNECTION, RABBITMQ_CHANNEL } from '../constants';
import amqplib from 'amqplib';

describe('RabbitMQService', () => {
  let rabbitmqService: RabbitMQService;
  let connection: amqplib.Connection;
  let channel: amqplib.Channel;

  beforeEach(async () => {
    const module = await Test.createTestingModule({
      imports: [ConfigModule],
      controllers: [],
      providers: [
        ...rabbitmqProviders,
        RabbitMQService,
      ],
      exports: [
        ...rabbitmqProviders,
        RabbitMQService,
      ],
    }).compile();

    rabbitmqService = module.get<RabbitMQService>(RabbitMQService);
    connection = module.get<amqplib.Connection>(RABBITMQ_CONNECTION);
    channel = module.get<amqplib.Channel>(RABBITMQ_CHANNEL);
  });

  describe('consume()', () => {
    test('should consume message and pass it back to callback', async () => {
      const assertQueue = jest.spyOn(channel, 'assertQueue').mockImplementation(() => { });
      const consume = jest.spyOn(channel, 'consume')
        .mockImplementation((queue: string, callback: (data: any) => void) => {
          return callback({ content: Buffer.from('Some message') });
        });
      const callback = jest.fn();

      await rabbitmqService.consume('fake_queue', callback);

      expect(assertQueue.mock.calls.length).toBe(1);
      expect(assertQueue.mock.calls[0][0]).toBe('fake_queue');
      expect(assertQueue.mock.calls[0][1]).toEqual({ durable: false });

      expect(consume.mock.calls.length).toBe(1);
      expect(consume.mock.calls[0][0]).toBe('fake_queue');

      expect(callback.mock.calls.length).toBe(1);
      expect(callback.mock.calls[0][0]).toBe('Some message');
    });
  });
});
