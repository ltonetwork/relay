import { Test } from '@nestjs/testing';
import { RabbitMQModuleConfig } from './rabbitmq.module';
import { RabbitMQService } from './rabbitmq.service';
import { HttpService } from '@nestjs/common';
import { AMQPLIB } from '../constants';

describe('RabbitMQService', () => {
  let rabbitmqService: RabbitMQService;
  let httpService: HttpService;
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
    await module.init();

    rabbitmqService = module.get<RabbitMQService>(RabbitMQService);
    httpService = module.get<HttpService>(HttpService);
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

  describe('addDynamicShovel()', () => {
    test('should add a dynamic shovel', async () => {
      const response = { status: 200, data: { bar: 'crux' } };
      const httpServiceSpy = jest.spyOn(httpService, 'put').mockImplementation(() => ({
        toPromise: () => Promise.resolve(response),
      }));

      const destination = 'amqp://destination';
      const queue = 'queue';
      expect(await rabbitmqService.addDynamicShovel(destination, queue)).toBe(response);

      expect(httpServiceSpy.mock.calls.length).toBe(1);
      expect(httpServiceSpy.mock.calls[0][0]).toBe('http://localhost:15672/api/parameters/shovel/%2F/default');
      expect(httpServiceSpy.mock.calls[0][1]).toEqual({
        value: {
          'dest-protocol': 'amqp091',
          'dest-queue': 'default',
          'dest-uri': destination,
          'src-protocol': 'amqp091',
          'src-queue': queue,
          'src-uri': 'amqp://',
        },
      });
      expect(httpServiceSpy.mock.calls[0][2]).toEqual({
        auth: {
          password: 'guest',
          username: 'guest',
        },
      });
    });
  });
});
