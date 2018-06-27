import { Test } from '@nestjs/testing';
import { RabbitMQModuleConfig } from './rabbitmq.module';
import { RabbitMQService } from './rabbitmq.service';
import { AMQPLIB } from '../constants';

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
  const connect = jest.fn(() => connection);

  beforeEach(async () => {
    const module = await Test.createTestingModule(RabbitMQModuleConfig)
      .overrideProvider(AMQPLIB)
      .useValue({ channel, connection, connect })
      .compile();

    rabbitmqService = module.get<RabbitMQService>(RabbitMQService);
  });

  describe('connect()', () => {
    test('should connect to rabbitmq and store the connection for reuse', async () => {
      const rabbitmqConnection = await rabbitmqService.connect('fake_url');
      expect(connect.mock.calls.length).toBe(1);
      expect(connect.mock.calls[0][0]).toBe('fake_url');
      expect(connection.createChannel.mock.calls.length).toBe(1);
      expect(Object.keys(rabbitmqService.connections).length).toBe(1);
      expect(rabbitmqService.connections).toEqual({
        fake_url: rabbitmqConnection,
      });

      const newRabbitmqConnection = await rabbitmqService.connect('new_fake_url');
      expect(Object.keys(rabbitmqService.connections).length).toBe(2);
      expect(rabbitmqService.connections).toEqual({
        fake_url: rabbitmqConnection,
        new_fake_url: newRabbitmqConnection,
      });

      expect(await rabbitmqService.connect('fake_url')).toBe(rabbitmqConnection);
    });
  });

  describe('close()', () => {
    test('should close all stored connections', async () => {
      const first = await rabbitmqService.connect('fake_url');
      const second = await rabbitmqService.connect('new_fake_url');

      expect(Object.keys(rabbitmqService.connections).length).toBe(2);

      const spyFirst = jest.spyOn(first, 'close');
      const spySecond = jest.spyOn(second, 'close');

      await rabbitmqService.close();

      expect(Object.keys(rabbitmqService.connections).length).toBe(0);

      expect(spyFirst.mock.calls.length).toBe(1);
      expect(spySecond.mock.calls.length).toBe(1);
    });
  });
});
