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
    test('hasModuleDispatcher()', async () => {
      expect(configService.hasModuleDispatcher()).toBe(true);
    });

    test('hasModuleQueuer()', async () => {
      expect(configService.hasModuleQueuer()).toBe(true);
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
      expect(configService.getRabbitMQPublicUrl()).toBe('amqp://localhost');

      configService.getHostname = jest.fn(() => 'example.com');
      expect(configService.getRabbitMQPublicUrl()).toBe('amqp://example.com');
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
      expect(configService.getRabbitMQExchange()).toBe('\'\'');
    });

    test('getRabbitMQQueue()', async () => {
      expect(configService.getRabbitMQQueue()).toBe('default');
    });

    test('getRabbitMQShovel()', async () => {
      expect(configService.getRabbitMQQueue()).toBe('default');
    });

    test('getLegalEventsUrl()', async () => {
      expect(configService.getLegalEventsUrl()).toBe('http://localhost:3030/api/events');
    });

    test('getLoggerConsole()', async () => {
      expect(configService.getLoggerConsole()).toEqual({ level: 'info' });
    });

    test('getLoggerCombined()', async () => {
      expect(configService.getLoggerCombined()).toEqual({ level: 'info' });
    });
  });
});
