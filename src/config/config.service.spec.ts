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
    test('getEnv()', async () => {
      expect(await configService.getEnv()).toBe('test');
    });

    test('getRabbitMQClient()', async () => {
      expect(await configService.getRabbitMQClient()).toBe('amqp://');
    });

    test('getRabbitMQCredentials()', async () => {
      expect(await configService.getRabbitMQCredentials()).toEqual({
        password: 'guest',
        username: 'guest',
      });
    });

    test('getRabbitMQVhost()', async () => {
      expect(await configService.getRabbitMQVhost()).toBe('/');
    });

    test('getRabbitMQApiUrl()', async () => {
      expect(await configService.getRabbitMQApiUrl()).toBe('http://localhost:15672/api');
    });

    test('getRabbitMQExchange()', async () => {
      expect(await configService.getRabbitMQExchange()).toBe('\'\'');
    });

    test('getRabbitMQQueue()', async () => {
      expect(await configService.getRabbitMQQueue()).toBe('default');
    });

    test('getRabbitMQShovel()', async () => {
      expect(await configService.getRabbitMQQueue()).toBe('default');
    });

    test('getLegalEventsUrl()', async () => {
      expect(await configService.getLegalEventsUrl()).toBe('http://localhost:3030/api/events');
    });
  });
});
