// noinspection DuplicatedCode

import { Test, TestingModule } from '@nestjs/testing';
import { InboxService } from './inbox.service';
import { ConfigModule } from '../common/config/config.module';
import { LoggerService } from '../common/logger/logger.service';
import Redis from 'ioredis';
import { Bucket } from 'any-bucket';
import { Message, AccountFactoryED25519, Account, Binary } from '@ltonetwork/lto';
import { ConfigService } from '../common/config/config.service';
import { version } from 'os';

describe('InboxService', () => {
  let module: TestingModule;

  let service: InboxService;
  let redis: jest.Mocked<Redis>;
  let bucket: jest.Mocked<Bucket>;
  let logger: jest.Mocked<LoggerService>;
  let config: ConfigService;

  let sender: Account;
  let recipient: Account;
  let message: Message;

  beforeEach(() => {
    redis = {
      hgetall: jest.fn(),
      hexists: jest.fn(),
      get: jest.fn(),
      hget: jest.fn(),
      hset: jest.fn(),
      set: jest.fn(),
      hdel: jest.fn(),
    } as any;

    bucket = {
      get: jest.fn(),
      put: jest.fn(),
      set: jest.fn(),
      delete: jest.fn(),
    } as any;

    logger = {
      debug: jest.fn(),
      warn: jest.fn(),
      error: jest.fn(),
    } as any;
  });

  beforeEach(async () => {
    module = await Test.createTestingModule({
      imports: [ConfigModule],
      providers: [
        InboxService,
        { provide: Redis, useValue: redis },
        { provide: 'INBOX_BUCKET', useValue: bucket },
        { provide: 'INBOX_THUMBNAIL_BUCKET', useValue: bucket },
        { provide: LoggerService, useValue: logger },
      ],
    }).compile();

    service = module.get<InboxService>(InboxService);
    config = module.get<ConfigService>(ConfigService);
  });

  beforeEach(async () => {
    const factory = new AccountFactoryED25519('T');

    sender = factory.createFromSeed('sender');
    recipient = factory.createFromSeed('recipient');
    message = new Message('hello').to(recipient).signWith(sender);
  });

  afterEach(async () => {
    jest.restoreAllMocks();
    await module.close();
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });

  describe('list', () => {
    let data: Record<string, any>;

    beforeEach(() => {
      data = {
        hash1: JSON.stringify({
          hash: 'hash1',
          type: 'basic',
          timestamp: 1672531200,
          sender: 'sender1',
          recipient: 'recipient1',
          size: 10,
          senderPublicKey: 'ed25519',
          publicKey: 'key1',
          mediaType: 'text/plain',
          data: 'foo',
        }),
        hash2: JSON.stringify({
          hash: 'hash2',
          type: 'other',
          timestamp: 1672531210,
          sender: 'sender2',
          recipient: 'recipient2',
          size: 20,
        }),
      };
    });

    it('should return all messages if type is not specified', async () => {
      const recipientAddress = recipient.address;
      redis.hgetall.mockResolvedValue(data);

      const result = await service.list(recipientAddress);

      expect(result).toEqual([
        { hash: 'hash1', type: 'basic', timestamp: 1672531200, sender: 'sender1', recipient: 'recipient1', size: 10 },
        { hash: 'hash2', type: 'other', timestamp: 1672531210, sender: 'sender2', recipient: 'recipient2', size: 20 },
      ]);
      expect(redis.hgetall).toHaveBeenCalledWith(`inbox:${recipientAddress}`);
    });

    it('should return filtered messages by type if type is specified', async () => {
      const recipientAddress = recipient.address;
      const type = 'basic';
      redis.hgetall.mockResolvedValue(data);

      const result = await service.list(recipientAddress, type);

      expect(result).toEqual([
        { hash: 'hash1', type: 'basic', timestamp: 1672531200, sender: 'sender1', recipient: 'recipient1', size: 10 },
      ]);
      expect(redis.hgetall).toHaveBeenCalledWith(`inbox:${recipientAddress}`);
    });
  });

  describe('has', () => {
    it("should return true if the message exists in the recipient's inbox", async () => {
      const recipientAddress = recipient.address;
      const hash = message.hash.base58;
      redis.hexists.mockResolvedValue(1);

      const result = await service.has(recipientAddress, hash);

      expect(result).toBe(true);
      expect(redis.hexists).toHaveBeenCalledWith(`inbox:${recipientAddress}`, hash);
    });

    it("should return false if the message does not exist in the recipient's inbox", async () => {
      const recipientAddress = recipient.address;
      const hash = message.hash.base58;
      redis.hexists.mockResolvedValue(0);

      const result = await service.has(recipientAddress, hash);

      expect(result).toBe(false);
      expect(redis.hexists).toHaveBeenCalledWith(`inbox:${recipientAddress}`, hash);
    });
  });

  describe('get', () => {
    it("should return the message if it exists in the recipient's inbox", async () => {
      const recipientAddress = recipient.address;
      const hash = message.hash.base58;

      const data = message.toJSON();
      const jsonMessage = JSON.stringify({
        ...data,
        size: message.data.length,
        senderPublicKey: sender.publicKey,
        senderKeyType: sender.keyType,
      });

      redis.hget.mockResolvedValue(jsonMessage);

      const result = await service.get(recipientAddress, hash);

      expect(result).toEqual(message);
      expect(redis.hget).toHaveBeenCalledWith(`inbox:${recipientAddress}`, hash);
    });

    it("should throw an error if the message does not exist in the recipient's inbox", async () => {
      const recipientAddress = recipient.address;
      const hash = message.hash.base58;
      redis.hget.mockResolvedValue(null);

      await expect(service.get(recipientAddress, hash)).rejects.toThrow('message not found');
      expect(redis.hget).toHaveBeenCalledWith(`inbox:${recipientAddress}`, hash);
    });
  });

  describe('store', () => {
    beforeEach(() => {
      jest.spyOn(config, 'isInboxEnabled').mockReturnValue(true);
    });

    it('should store index in Redis and the message in the bucket if not embedded', async () => {
      jest.spyOn(config, 'getStorageEmbedMaxSize').mockReturnValue(0);
      const recipientAddress = recipient.address;

      await service.store(message);

      expect(logger.debug).toHaveBeenCalledWith(`storage: storing message '${message.hash.base58}'`);

      expect(redis.hset).toHaveBeenCalled();
      expect(redis.hset.mock.calls[0][0]).toBe(`inbox:${recipientAddress}`);
      expect(redis.hset.mock.calls[0][1]).toBe(message.hash.base58);
      expect(JSON.parse(redis.hset.mock.calls[0][2] as string)).toEqual({
        hash: message.hash.base58,
        version: 0,
        type: 'basic',
        meta: {
          description: '',
          title: '',
          type: 'basic',
        },
        timestamp: message.timestamp.toJSON(),
        sender: sender.address,
        senderKeyType: sender.keyType,
        senderPublicKey: sender.publicKey,
        recipient: recipient.address,
        mediaType: 'text/plain',
        size: message.data.length,
        signature: message.signature.base58,
      });

      expect(bucket.put).toHaveBeenCalled();
      expect(bucket.put.mock.calls[0][0]).toBe(message.hash.base58);
      expect(bucket.put.mock.calls[0][1]).toBeInstanceOf(Uint8Array);
      expect(bucket.put.mock.calls[0][1]).toEqual(message.toBinary());
    });

    it('should store the message and index in Redis if storage is enabled and embedded', async () => {
      jest.spyOn(config, 'getStorageEmbedMaxSize').mockReturnValue(1024);
      const recipientAddress = recipient.address;

      await service.store(message);

      expect(logger.debug).toHaveBeenCalledWith(`storage: storing message '${message.hash.base58}'`);

      expect(redis.hset).toHaveBeenCalled();
      expect(redis.hset.mock.calls[0][0]).toBe(`inbox:${recipientAddress}`);
      expect(redis.hset.mock.calls[0][1]).toBe(message.hash.base58);
      expect(JSON.parse(redis.hset.mock.calls[0][2] as string)).toEqual({
        hash: message.hash.base58,
        version: 0,
        type: 'basic',
        meta: {
          description: '',
          title: '',
          type: 'basic',
        },
        timestamp: message.timestamp.toJSON(),
        sender: sender.address,
        senderKeyType: sender.keyType,
        senderPublicKey: sender.publicKey,
        recipient: recipient.address,
        mediaType: 'text/plain',
        size: message.data.length,
        data: 'base64:' + message.data.base64,
        signature: message.signature.base58,
      });

      expect(bucket.put).not.toHaveBeenCalled();
    });

    it('should store the message and thumbnail when not embedded and thumbnail is present', async () => {
      jest.spyOn(config, 'getStorageEmbedMaxSize').mockReturnValue(0);

      message = new Message('hello', 'text/plain', {
        type: 'basic',
        title: '',
        description: '',
        thumbnail: Binary.from('hello'),
      })
        .to(recipient)
        .signWith(sender);

      const thumbnailBucket = module.get<Bucket>('INBOX_THUMBNAIL_BUCKET');
      const thumbnailPutSpy = jest.spyOn(thumbnailBucket, 'put');

      await service.store(message);

      const storedData = JSON.parse(String(redis.hset.mock.calls[0][2]));

      expect(storedData.meta.thumbnail).toBe(Binary.from('hello').base64);

      expect(thumbnailPutSpy).toHaveBeenCalledWith(message.hash.base58, expect.any(Binary));
      expect(bucket.put).toHaveBeenCalledWith(message.hash.base58, message.toBinary());
    });
  });

  describe('delete', () => {
    it('should throw an error if the message does not exist', async () => {
      const recipientAddress = recipient.address;
      const hash = message.hash.base58;
      redis.hexists.mockResolvedValue(0);

      await expect(service.delete(recipientAddress, hash)).rejects.toThrow('Message not found');
      expect(redis.hexists).toHaveBeenCalledWith(`inbox:${recipientAddress}`, hash);
      expect(logger.warn).toHaveBeenCalledWith(
        `delete: message '${hash}' not found for recipient '${recipientAddress}'`,
      );
    });

    it('should delete a message and associated files if it exists', async () => {
      const recipientAddress = recipient.address;
      const hash = message.hash.base58;
      redis.hexists.mockResolvedValue(1); // has() will return true
      redis.hget.mockResolvedValue(JSON.stringify({ thumbnail: true }));
      redis.hdel.mockResolvedValue(1);

      const mockThumbnailBucket = service['thumbnail_bucket'] as jest.Mocked<Bucket>;
      const mockBucket = service['bucket'] as jest.Mocked<Bucket>;

      mockThumbnailBucket.delete = jest.fn();
      mockBucket.delete = jest.fn();

      await service.delete(recipientAddress, hash);

      expect(redis.hdel).toHaveBeenCalledWith(`inbox:${recipientAddress}`, hash);
      expect(mockThumbnailBucket.delete).toHaveBeenCalledWith(hash);
      expect(mockBucket.delete).toHaveBeenCalledWith(hash);

      expect(logger.debug).toHaveBeenCalledWith(
        `delete: message '${hash}' deleted from Redis for recipient '${recipientAddress}'`,
      );
      expect(logger.debug).toHaveBeenCalledWith(`delete: file '${hash}' deleted from bucket storage`);
    });

    it('should handle NoSuchKey error gracefully', async () => {
      const recipientAddress = recipient.address;
      const hash = message.hash.base58;
      redis.hexists.mockResolvedValue(1);
      redis.hget.mockResolvedValue(JSON.stringify({ thumbnail: false }));
      redis.hdel.mockResolvedValue(1);

      const err = { code: 'NoSuchKey' };
      bucket.delete.mockRejectedValueOnce(err);

      await service.delete(recipientAddress, hash);

      expect(logger.warn).toHaveBeenCalledWith(`delete: file '${hash}' not found in bucket storage`);
    });
  });

  describe('getMessagesMetadata', () => {
    it('should return parsed messages sorted by timestamp descending', async () => {
      const recipientAddress = recipient.address;
      const data = {
        hash1: JSON.stringify({
          hash: 'hash1',
          type: 'basic',
          timestamp: '2023-01-01T10:00:00Z',
          sender: 'sender1',
          recipient: 'recipient1',
          size: 10,
        }),
        hash2: JSON.stringify({
          hash: 'hash2',
          type: 'basic',
          timestamp: '2023-01-01T11:00:00Z',
          sender: 'sender2',
          recipient: 'recipient2',
          size: 20,
        }),
      };

      redis.hgetall.mockResolvedValue(data);

      const result = await service.getMessagesMetadata(recipientAddress);

      expect(result).toEqual([
        {
          hash: 'hash2',
          type: 'basic',
          timestamp: '2023-01-01T11:00:00Z',
          sender: 'sender2',
          recipient: 'recipient2',
          size: 20,
        },
        {
          hash: 'hash1',
          type: 'basic',
          timestamp: '2023-01-01T10:00:00Z',
          sender: 'sender1',
          recipient: 'recipient1',
          size: 10,
        },
      ]);

      expect(redis.hgetall).toHaveBeenCalledWith(`inbox:${recipientAddress}`);
    });

    it('should return an empty array if no messages exist', async () => {
      const recipientAddress = recipient.address;
      redis.hgetall.mockResolvedValue({});

      const result = await service.getMessagesMetadata(recipientAddress);

      expect(result).toEqual([]);
    });

    it('should throw an error if a message has invalid JSON', async () => {
      const recipientAddress = recipient.address;
      redis.hgetall.mockResolvedValue({
        hash1: '{ invalid json',
      });

      await expect(service.getMessagesMetadata(recipientAddress)).rejects.toThrowError(
        expect.objectContaining({
          message: expect.stringContaining(`Failed to parse message item for ${recipientAddress}`),
        }),
      );
    });

    it('should throw a wrapped error if Redis fails', async () => {
      const recipientAddress = recipient.address;
      const redisError = new Error('Redis down');
      redis.hgetall.mockRejectedValue(redisError);

      await expect(service.getMessagesMetadata(recipientAddress)).rejects.toThrow(
        'Unable to retrieve message metadata',
      );
    });
  });

  describe('loadThumbnail', () => {
    it('should handle NoSuchKey error when loading thumbnail', async () => {
      const thumbnailBucket = module.get('INBOX_THUMBNAIL_BUCKET');
      jest.spyOn(thumbnailBucket, 'get').mockRejectedValue({ code: 'NoSuchKey' });

      const result = await (service as any).loadThumbnail('hash1');

      expect(result).toBeUndefined();
      expect(logger.warn).toHaveBeenCalledWith(`Thumbnail file 'hash1' not found in bucket storage`);
    });

    it('should handle general errors when loading thumbnail', async () => {
      const error = new Error('Bucket error');
      jest.spyOn(bucket, 'get').mockRejectedValue(error);

      const result = await (service as any).loadThumbnail('hash1');

      expect(result).toBeUndefined();
      expect(logger.error).toHaveBeenCalledWith(`Failed to load thumbnail 'hash1' from bucket`, error);
    });
  });

  describe('create from embedded and load from file', () => {
    it('should load message from file', async () => {
      (bucket.get as jest.Mock).mockResolvedValue(message.toBinary());

      const result = await (service as any).loadFromFile(message.hash.base58);

      expect(result).toEqual(expect.objectContaining({ data: message.data }));
      expect(bucket.get).toHaveBeenCalledWith(message.hash.base58);
    });
  });

  describe('getLastModified', () => {
    it('should return the last modified date', async () => {
      const recipientAddress = recipient.address;
      const now = new Date().toISOString();
      redis.get.mockResolvedValue(now);

      const result = await service.getLastModified(recipientAddress);
      expect(result).toEqual(new Date(now));
    });

    it('should return epoch date if no last modified date exists', async () => {
      const recipientAddress = recipient.address;
      redis.get.mockResolvedValue(null);

      const result = await service.getLastModified(recipientAddress);
      expect(result).toEqual(new Date(0));
    });
  });
});
