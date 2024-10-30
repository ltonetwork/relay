import { Test, TestingModule } from '@nestjs/testing';
import { MessageService } from './message.service';
import Redis from 'ioredis';

describe('MessageService', () => {
  let service: MessageService;
  let redis: jest.Mocked<Redis>;

  beforeEach(async () => {
    redis = {
      hget: jest.fn(),
      hexists: jest.fn(),
      hlen: jest.fn(),
      hkeys: jest.fn(),
    } as any;

    const module: TestingModule = await Test.createTestingModule({
      providers: [MessageService, { provide: Redis, useValue: redis }],
    }).compile();

    service = module.get<MessageService>(MessageService);
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  describe('get', () => {
    it('should return the message if it exists', async () => {
      const recipient = 'recipient1';
      const hash = 'hash1';
      const messageData = JSON.stringify({ hash, data: 'test data' });
      redis.hget.mockResolvedValue(messageData);

      const result = await service.get(recipient, hash);

      expect(result).toEqual({ hash });
      expect(redis.hget).toHaveBeenCalledWith(`inbox:${recipient}`, hash);
    });

    it('should throw an error if the message does not exist', async () => {
      const recipient = 'recipient1';
      const hash = 'nonexistentHash';
      redis.hget.mockResolvedValue(null);

      await expect(service.get(recipient, hash)).rejects.toThrow('message not found');
      expect(redis.hget).toHaveBeenCalledWith(`inbox:${recipient}`, hash);
    });
  });

  describe('has', () => {
    it('should return true if the message exists', async () => {
      const recipient = 'recipient1';
      const hash = 'hash1';
      redis.hexists.mockResolvedValue(1);

      const result = await service.has(recipient, hash);

      expect(result).toBe(true);
      expect(redis.hexists).toHaveBeenCalledWith(`inbox:${recipient}`, hash);
    });

    it('should return false if the message does not exist', async () => {
      const recipient = 'recipient1';
      const hash = 'hash1';
      redis.hexists.mockResolvedValue(0);

      const result = await service.has(recipient, hash);

      expect(result).toBe(false);
      expect(redis.hexists).toHaveBeenCalledWith(`inbox:${recipient}`, hash);
    });
  });

  describe('getMessageCount', () => {
    it('should return the correct message count', async () => {
      const recipient = 'recipient1';
      redis.hlen.mockResolvedValue(5);

      const result = await service.getMessageCount(recipient);

      expect(result).toBe(5);
      expect(redis.hlen).toHaveBeenCalledWith(`inbox:${recipient}`);
    });
  });

  describe('getMessageHashes', () => {
    it('should return a list of message hashes', async () => {
      const recipient = 'recipient1';
      const hashes = ['hash1', 'hash2'];
      redis.hkeys.mockResolvedValue(hashes);

      const result = await service.getMessageHashes(recipient);

      expect(result).toEqual(hashes);
      expect(redis.hkeys).toHaveBeenCalledWith(`inbox:${recipient}`);
    });
  });
});
