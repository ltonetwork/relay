import { RabbitMQConnection } from './rabbitmq.connection';

describe('RabbitMQConnection', () => {
  function spy() {
    const rmqCallback = jest.fn();
    const rmqChannel = {
      close: jest.fn(),
      assertQueue: jest.fn(),
      assertExchange: jest.fn(),
      bindQueue: jest.fn(),
      publish: jest.fn(),
      consume: jest.fn((queue: string, callback: (data: any) => void) => {
        return rmqCallback({ content: Buffer.from('Some message') });
      }),
    };
    const rmqConnection = {
      close: jest.fn(),
      createChannel: jest.fn(() => rmqChannel),
    };

    return { rmqConnection, rmqChannel, rmqCallback };
  }

  describe('consume()', () => {
    test('should consume message from the channel and pass it back to callback', async () => {
      const spies = spy();

      const rabbitmqConnection = new RabbitMQConnection(spies.rmqConnection as any, spies.rmqChannel as any);
      await rabbitmqConnection.consume('fake_exchange', 'fake_queue', spies.rmqCallback);

      // init phase
      expect(spies.rmqChannel.assertQueue.mock.calls.length).toBe(1);
      expect(spies.rmqChannel.assertQueue.mock.calls[0][0]).toBe('fake_queue');
      expect(spies.rmqChannel.assertExchange.mock.calls.length).toBe(1);
      expect(spies.rmqChannel.assertExchange.mock.calls[0][0]).toBe('fake_exchange');
      expect(spies.rmqChannel.bindQueue.mock.calls.length).toBe(1);
      expect(spies.rmqChannel.bindQueue.mock.calls[0][0]).toBe('fake_queue');
      expect(spies.rmqChannel.bindQueue.mock.calls[0][1]).toBe('fake_exchange');
      expect(spies.rmqChannel.bindQueue.mock.calls[0][2]).toBe('fake_queue');

      expect(spies.rmqChannel.consume.mock.calls.length).toBe(1);
      expect(spies.rmqChannel.consume.mock.calls[0][0]).toBe('fake_queue');
      expect(typeof spies.rmqChannel.consume.mock.calls[0][1]).toBe('function');

      expect(spies.rmqCallback.mock.calls.length).toBe(1);
      expect(spies.rmqCallback.mock.calls[0][0]).toEqual({ content: Buffer.from('Some message') });
    });
  });

  describe('publish()', () => {
    test('should publish message and send it to the queue through the exchange', async () => {
      const spies = spy();

      const rabbitmqConnection = new RabbitMQConnection(spies.rmqConnection as any, spies.rmqChannel as any);
      await rabbitmqConnection.publish('fake_exchange', 'fake_queue', 'This is produced');

      // init phase
      expect(spies.rmqChannel.assertQueue.mock.calls.length).toBe(1);
      expect(spies.rmqChannel.assertQueue.mock.calls[0][0]).toBe('fake_queue');
      expect(spies.rmqChannel.assertExchange.mock.calls.length).toBe(1);
      expect(spies.rmqChannel.assertExchange.mock.calls[0][0]).toBe('fake_exchange');
      expect(spies.rmqChannel.bindQueue.mock.calls.length).toBe(1);
      expect(spies.rmqChannel.bindQueue.mock.calls[0][0]).toBe('fake_queue');
      expect(spies.rmqChannel.bindQueue.mock.calls[0][1]).toBe('fake_exchange');
      expect(spies.rmqChannel.bindQueue.mock.calls[0][2]).toBe('fake_queue');

      expect(spies.rmqChannel.publish.mock.calls.length).toBe(1);
      expect(spies.rmqChannel.publish.mock.calls[0][0]).toBe('fake_exchange');
      expect(spies.rmqChannel.publish.mock.calls[0][1]).toBe('fake_queue');
      expect(spies.rmqChannel.publish.mock.calls[0][2]).toEqual(Buffer.from('This is produced'));
    });
  });

  describe('close()', () => {
    test('should close connection and channel', async () => {
      const spies = spy();

      const rabbitmqConnection = new RabbitMQConnection(spies.rmqConnection as any, spies.rmqChannel as any);
      await rabbitmqConnection.close();

      expect(spies.rmqConnection.close.mock.calls.length).toBe(1);
      expect(spies.rmqChannel.close.mock.calls.length).toBe(1);
    });
  });
});
