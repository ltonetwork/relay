import { RabbitMQService } from './rabbitmq.service';

describe('RabbitMQService', () => {
  describe('connect()', () => {
    it('should connect based on the given config', async () => {
      const rabbitmqService = new RabbitMQService();
      const config = { url: 'amqp://localhost', queue: 'fake_queue' };
      await rabbitmqService.connect(config);
      expect(config).toEqual({});
    });
  });
});
