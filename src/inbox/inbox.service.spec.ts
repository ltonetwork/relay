import { Test, TestingModule } from '@nestjs/testing';
import { InboxService } from './inbox.service';
import { ConfigModule } from '../common/config/config.module';
import { LoggerService } from '../common/logger/logger.service';
import Redis from 'ioredis';
import { Bucket } from 'any-bucket';
import { Message, AccountFactoryED25519, Account } from '@ltonetwork/lto';
import { ConfigService } from '../common/config/config.service';

describe('InboxService', () => {
  let module: TestingModule;

  let service: InboxService;
  let redis: jest.Mocked<Redis>;
  let bucket: jest.Mocked<Bucket>;
  let logger: jest.Mocked<LoggerService>;
  let config: jest.Mocked<ConfigService>;

  let sender: Account;
  let recipient: Account;
  let message: Message;

  beforeEach(() => {
    redis = {
      hgetall: jest.fn(),
      hexists: jest.fn(),
      hget: jest.fn(),
      hset: jest.fn(),
      hkeys: jest.fn(),
      hdel: jest.fn(),
      get: jest.fn(),
      set: jest.fn(),
    } as any;

    bucket = {
      get: jest.fn(),
      put: jest.fn(),
      delete: jest.fn(),
    } as any;

    logger = {
      debug: jest.fn(),
      warn: jest.fn(),
      error: jest.fn(),
    } as any;

    config = {
      isInboxEnabled: jest.fn(),
      getStorageEmbedMaxSize: jest.fn(),
    } as any;
  });

  beforeEach(async () => {
    module = await Test.createTestingModule({
      imports: [ConfigModule],
      providers: [
        InboxService,
        { provide: Redis, useValue: redis },
        { provide: 'INBOX_BUCKET', useValue: bucket },
        { provide: LoggerService, useValue: logger },
        { provide: ConfigService, useValue: config },
      ],
    }).compile();

    service = module.get<InboxService>(InboxService);

    const factory = new AccountFactoryED25519('T');
    sender = factory.createFromSeed('sender');
    recipient = factory.createFromSeed('recipient');
    message = new Message('hello').to(recipient).signWith(sender);
  });

  afterEach(() => {
    jest.restoreAllMocks();
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });

  describe('list', () => {
    it('should return all messages if no type is specified', async () => {
      const recipientAddress = recipient.address;
      redis.hgetall.mockResolvedValue({
        hash1: JSON.stringify({
          hash: 'hash1',
          type: 'basic',
          timestamp: 1672531200,
          sender: 'sender1',
          recipient: recipientAddress,
          size: 10,
        }),
        hash2: JSON.stringify({
          hash: 'hash2',
          type: 'other',
          timestamp: 1672531210,
          sender: 'sender2',
          recipient: recipientAddress,
          size: 20,
        }),
      });

      const result = await service.list(recipientAddress);

      expect(result).toEqual([
        {
          hash: 'hash1',
          type: 'basic',
          timestamp: 1672531200,
          sender: 'sender1',
          recipient: recipientAddress,
          size: 10,
        },
        {
          hash: 'hash2',
          type: 'other',
          timestamp: 1672531210,
          sender: 'sender2',
          recipient: recipientAddress,
          size: 20,
        },
      ]);
      expect(redis.hgetall).toHaveBeenCalledWith(`inbox:${recipientAddress}`);
    });

    it('should return filtered messages by type', async () => {
      const recipientAddress = recipient.address;
      redis.hgetall.mockResolvedValue({
        hash1: JSON.stringify({
          hash: 'hash1',
          type: 'basic',
          timestamp: 1672531200,
          sender: 'sender1',
          recipient: recipientAddress,
          size: 10,
        }),
      });

      const result = await service.list(recipientAddress, 'basic');

      expect(result).toEqual([
        {
          hash: 'hash1',
          type: 'basic',
          timestamp: 1672531200,
          sender: 'sender1',
          recipient: recipientAddress,
          size: 10,
        },
      ]);
      expect(redis.hgetall).toHaveBeenCalledWith(`inbox:${recipientAddress}`);
    });
  });

  describe('has', () => {
    it('should return true if the message exists', async () => {
      redis.hexists.mockResolvedValue(1);

      const result = await service.has(recipient.address, 'hash1');

      expect(result).toBe(true);
      expect(redis.hexists).toHaveBeenCalledWith(`inbox:${recipient.address}`, 'hash1');
    });

    it('should return false if the message does not exist', async () => {
      redis.hexists.mockResolvedValue(0);

      const result = await service.has(recipient.address, 'hash1');

      expect(result).toBe(false);
      expect(redis.hexists).toHaveBeenCalledWith(`inbox:${recipient.address}`, 'hash1');
    });
  });

  describe('get', () => {
    it('should return the message if it exists', async () => {
      redis.hget.mockResolvedValue(JSON.stringify(message.toJSON()));

      const result = await service.get(recipient.address, 'hash1');

      expect(result).toEqual(expect.objectContaining({ data: message.data }));
      expect(redis.hget).toHaveBeenCalledWith(`inbox:${recipient.address}`, 'hash1');
    });

    it('should throw an error if the message does not exist', async () => {
      redis.hget.mockResolvedValue(null);

      await expect(service.get(recipient.address, 'hash1')).rejects.toThrow('message not found');
      expect(redis.hget).toHaveBeenCalledWith(`inbox:${recipient.address}`, 'hash1');
    });

    it('should throw an error if senderPublicKey is missing', async () => {
      const invalidData = {
        ...message.toJSON(),
        senderPublicKey: undefined,
      };
      redis.hget.mockResolvedValue(JSON.stringify(invalidData));

      await expect(service.get(recipient.address, 'hash1')).rejects.toThrow(
        'Invalid message data: senderPublicKey is missing',
      );
    });
  });

  describe('store', () => {
    beforeEach(() => {
      config.isInboxEnabled.mockReturnValue(true);
      jest.spyOn(config, 'getStorageEmbedMaxSize').mockReturnValue(1024);
    });

    it('should store the message in Redis when embedded', async () => {
      redis.hexists.mockResolvedValue(0);

      await service.store(message);

      expect(redis.hset).toHaveBeenCalledWith(
        `inbox:${recipient.address}`,
        message.hash.base58,
        expect.stringContaining('"type":"basic"'),
      );
      expect(bucket.put).not.toHaveBeenCalled();
    });

    it('should store the message in the bucket if not embedded', async () => {
      jest.spyOn(config, 'getStorageEmbedMaxSize').mockReturnValue(0);
      redis.hexists.mockResolvedValue(0);

      await service.store(message);

      expect(bucket.put).toHaveBeenCalledWith(message.hash.base58, expect.any(Uint8Array));
      expect(redis.hset).toHaveBeenCalled();
    });
  });

  describe('updateLastModified', () => {
    it('should update the last modified timestamp in Redis', async () => {
      await service.updateLastModified(recipient.address);

      expect(redis.set).toHaveBeenCalledWith(`inbox:${recipient.address}:lastModified`, expect.any(String));
    });
  });

  describe('getMessagesMetadata', () => {
    it('should return all messages without the data field', async () => {
      const recipientAddress = recipient.address;

      redis.hgetall.mockResolvedValue({
        hash1: JSON.stringify({
          hash: 'hash1',
          type: 'basic',
          timestamp: 1672531200,
          sender: 'sender1',
          recipient: recipientAddress,
          size: 10,
          data: 'some data',
        }),
        hash2: JSON.stringify({
          hash: 'hash2',
          type: 'other',
          timestamp: 1672531210,
          sender: 'sender2',
          recipient: recipientAddress,
          size: 20,
          data: 'some other data',
        }),
      });

      const result = await service.getMessagesMetadata(recipientAddress);

      expect(result).toEqual([
        {
          hash: 'hash1',
          type: 'basic',
          timestamp: 1672531200,
          sender: 'sender1',
          recipient: recipientAddress,
          size: 10,
        },
        {
          hash: 'hash2',
          type: 'other',
          timestamp: 1672531210,
          sender: 'sender2',
          recipient: recipientAddress,
          size: 20,
        },
      ]);

      expect(redis.hgetall).toHaveBeenCalledWith(`inbox:${recipientAddress}`);
    });

    it('should return an empty array if no messages exist', async () => {
      const recipientAddress = recipient.address;
      redis.hgetall.mockResolvedValue({});

      const result = await service.getMessagesMetadata(recipientAddress);

      expect(result).toEqual([]);
      expect(redis.hgetall).toHaveBeenCalledWith(`inbox:${recipientAddress}`);
    });

    it('should handle invalid JSON gracefully', async () => {
      const recipientAddress = recipient.address;

      redis.hgetall.mockResolvedValue({
        hash1: '{ invalid JSON',
      });

      const result = await service.getMessagesMetadata(recipientAddress);

      expect(result).toEqual([]);
      expect(redis.hgetall).toHaveBeenCalledWith(`inbox:${recipientAddress}`);
    });
  });
});
