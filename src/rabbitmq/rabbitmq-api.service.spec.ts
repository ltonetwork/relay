import { Test, TestingModule } from '@nestjs/testing';
import { RabbitMQModuleConfig } from './rabbitmq.module';
import { RabbitMQApiService } from './rabbitmq-api.service';
import { RequestService } from '../common/request/request.service';

describe('RabbitMQApiService', () => {
  let module: TestingModule;
  let rabbitmqApiService: RabbitMQApiService;
  let requestService: RequestService;

  beforeEach(async () => {
    module = await Test.createTestingModule(RabbitMQModuleConfig).compile();
    await module.init();

    rabbitmqApiService = module.get<RabbitMQApiService>(RabbitMQApiService);
    requestService = module.get<RequestService>(RequestService);
  });

  afterEach(async () => {
    await module.close();
  });

  describe('addDynamicShovel()', () => {
    test('should add a dynamic shovel', async () => {
      const response = { status: 200, data: { bar: 'crux' } };
      const requestServiceSpy = jest.spyOn(requestService, 'put').mockImplementation(() => Promise.resolve(response as any));

      const destination = 'amqp://destination';
      const queue = 'queue';
      expect(await rabbitmqApiService.addDynamicShovel(queue, destination)).toBe(response);

      expect(requestServiceSpy.mock.calls.length).toBe(1);
      expect(requestServiceSpy.mock.calls[0][0]).toBe('http://localhost:15672/api/parameters/shovel/%2F/default');
      expect(requestServiceSpy.mock.calls[0][1]).toEqual({
        value: {
          'dest-queue': 'default',
          'dest-uri': destination,
          'src-queue': queue,
          'src-uri': 'amqp://',
        },
      });
      expect(requestServiceSpy.mock.calls[0][2]).toEqual({
        auth: {
          password: 'guest',
          username: 'guest',
        },
      });
    });
  });
});
