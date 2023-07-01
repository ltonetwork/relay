import { Test, TestingModule } from '@nestjs/testing';
import { ConfigModuleConfig } from './config.module';
import { ConfigService } from './config.service';

describe('ConfigService', () => {
  let module: TestingModule;
  let configService: ConfigService;

  beforeEach(async () => {
    module = await Test.createTestingModule(ConfigModuleConfig).compile();
    await module.init();

    configService = module.get<ConfigService>(ConfigService);
  });

  afterEach(async () => {
    await module.close();
  });

  describe('get config', () => {
    test('isDispatcherEnabled()', async () => {
      expect(configService.isDispatcherEnabled()).toBe(true);
    });

    test('isStorageEnabled()', async () => {
      expect(configService.isStorageEnabled()).toBe(true);
    });

    test('isQueuerEnabled()', async () => {
      expect(configService.isQueuerEnabled()).toBe(true);
    });

    test('getDispatchTarget()', async () => {
      expect(configService.getDispatchTarget()).toBe('');
    });

    test('getEnv()', async () => {
      expect(configService.getEnv()).toBe('test');
    });

    test('getHostname()', async () => {
      expect(configService.getHostname()).toBe('localhost');
    });

    test('getRabbitMQClient()', async () => {
      expect(configService.getRabbitMQClient()).toBe('amqp://');
    });

    test('getRabbitMQClientAsObject()', async () => {
      expect(configService.getRabbitMQClientAsObject()).toEqual({
        hostname: 'localhost',
        password: 'guest',
        port: 5672,
        protocol: 'amqp',
        username: 'guest',
        vhost: '/',
      });
    });

    test('getRabbitMQPublicUrl()', async () => {
      expect(configService.getRabbitMQPublicUrl()).toBe('amqp://guest:guest@localhost:5672');

      configService.getHostname = jest.fn(() => 'example.com');
      expect(configService.getRabbitMQPublicUrl()).toBe('amqp://guest:guest@example.com:5672');
    });

    test('getRabbitMQCredentials()', async () => {
      expect(configService.getRabbitMQCredentials()).toEqual({
        password: 'guest',
        username: 'guest',
      });
    });

    test('getRabbitMQVhost()', async () => {
      expect(configService.getRabbitMQVhost()).toBe('/');
    });

    test('getRabbitMQApiUrl()', async () => {
      expect(configService.getRabbitMQApiUrl()).toBe('http://localhost:15672/api');
    });

    test('getRabbitMQExchange()', async () => {
      expect(configService.getRabbitMQExchange()).toBe("amq.direct");
    });

    test('getRabbitMQQueue()', async () => {
      expect(configService.getRabbitMQQueue()).toBe('default');
    });

    test('getRabbitMQShovel()', async () => {
      expect(configService.getRabbitMQQueue()).toBe('default');
    });
  });
});
