// Mock eqty-core before importing the service
jest.mock('eqty-core', () => ({
  Message: class MockMessage {
    static from(data: any) {
      return new MockMessage();
    }
    static fromJSON(json: any) {
      return new MockMessage();
    }
    toJSON() {
      return { type: 'basic', data: 'hello' };
    }
    toBinary() {
      return new Uint8Array([1, 2, 3]);
    }
  },
  Binary: class MockBinary {
    constructor(data: any) {}
    get base64() {
      return 'aGVsbG8=';
    }
    static fromBase58(data: string) {
      return new MockBinary(data);
    }
  },
}));

// noinspection DuplicatedCode

import { Test, TestingModule } from '@nestjs/testing';
import { InboxService } from './inbox.service';
import { ConfigModule } from '../common/config/config.module';
import { LoggerService } from '../common/logger/logger.service';
import Redis from 'ioredis';
import { Bucket } from 'any-bucket';
import { Message, AccountFactoryED25519, Account, Binary } from '@ltonetwork/lto';
import { ConfigService } from '../common/config/config.service';

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
      hkeys: jest.fn(),
      hexists: jest.fn(),
      get: jest.fn(),
      hget: jest.fn(),
      hset: jest.fn(),
      hdel: jest.fn(),
      set: jest.fn(),
    } as any;

    bucket = {
      get: jest.fn(),
      put: jest.fn(),
      set: jest.fn(),
      delete: jest.fn(),
    } as any;

    logger = {
      debug: jest.fn(),
      error: jest.fn(),
      warn: jest.fn(),
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

      redis.hkeys.mockResolvedValue(['hash1', 'hash2']);
      redis.hget.mockImplementation((_key, field) => Promise.resolve(data[String(field)]));
    });

    it('should return all messages if type is not specified', async () => {
      const recipientAddress = recipient.address;
      redis.hkeys.mockResolvedValue(['hash1', 'hash2']);
      redis.hget
        .mockResolvedValueOnce(
          JSON.stringify({
            hash: 'hash1',
            type: 'basic',
            timestamp: 1672531200,
            sender: 'sender1',
            recipient: 'recipient1',
            size: 10,
          }),
        )
        .mockResolvedValueOnce(
          JSON.stringify({
            hash: 'hash2',
            type: 'other',
            timestamp: 1672531210,
            sender: 'sender2',
            recipient: 'recipient2',
            size: 20,
          }),
        );

      const result = await service.list(recipientAddress);

      expect(result.items).toEqual([
        {
          hash: 'hash1',
          type: 'basic',
          timestamp: 1672531200,
          sender: 'sender1',
          recipient: 'recipient1',
          size: 10,
          meta: {},
        },
        {
          hash: 'hash2',
          type: 'other',
          timestamp: 1672531210,
          sender: 'sender2',
          recipient: 'recipient2',
          size: 20,
          meta: {},
        },
      ]);
      expect(redis.hkeys).toHaveBeenCalledWith(`inbox:${recipientAddress.toLowerCase()}`);
    });

    it('should return filtered messages by type when no pagination', async () => {
      const recipientAddress = recipient.address;
      const result = await service.list(recipientAddress, { type: 'basic' });

      expect(result).toEqual({
        items: [
          {
            hash: 'hash1',
            type: 'basic',
            timestamp: 1672531200,
            sender: 'sender1',
            recipient: 'recipient1',
            size: 10,
            senderPublicKey: 'ed25519',
            publicKey: 'key1',
            mediaType: 'text/plain',
            meta: {},
          },
        ],
        total: 2,
        hasMore: false,
      });

      expect(redis.hkeys).toHaveBeenCalledWith(`inbox:${recipientAddress}`);
      expect(redis.hget).toHaveBeenCalledWith(`inbox:${recipientAddress}`, 'hash1');
      expect(redis.hget).toHaveBeenCalledWith(`inbox:${recipientAddress}`, 'hash2');
    });

    it('should return paginated messages when limit and offset are provided', async () => {
      const recipientAddress = recipient.address;
      const type = 'basic';
      redis.hkeys.mockResolvedValue(['hash1', 'hash2']);
      redis.hget
        .mockResolvedValueOnce(
          JSON.stringify({
            hash: 'hash1',
            type: 'basic',
            timestamp: 1672531200,
            sender: 'sender1',
            recipient: 'recipient1',
            size: 10,
          }),
        )
        .mockResolvedValueOnce(
          JSON.stringify({
            hash: 'hash2',
            type: 'other',
            timestamp: 1672531210,
            sender: 'sender2',
            recipient: 'recipient2',
            size: 20,
          }),
        );

      const result = await service.list(recipientAddress, { type });

      expect(result.items).toEqual([
        {
          hash: 'hash1',
          type: 'basic',
          timestamp: 1672531200,
          sender: 'sender1',
          recipient: 'recipient1',
          size: 10,
          meta: {},
        },
      ]);
      expect(redis.hkeys).toHaveBeenCalledWith(`inbox:${recipientAddress.toLowerCase()}`);
    });
  });

  describe('has', () => {
    it("should return true if the message exists in the recipient's inbox", async () => {
      const recipientAddress = recipient.address;
      const hash = message.hash.base58;
      redis.hexists.mockResolvedValue(1);

      const result = await service.has(recipientAddress, hash);

      expect(result).toBe(true);
      expect(redis.hexists).toHaveBeenCalledWith(`inbox:${recipientAddress.toLowerCase()}`, hash);
    });

    it("should return false if the message does not exist in the recipient's inbox", async () => {
      const recipientAddress = recipient.address;
      const hash = message.hash.base58;
      redis.hexists.mockResolvedValue(0);

      const result = await service.has(recipientAddress, hash);

      expect(result).toBe(false);
      expect(redis.hexists).toHaveBeenCalledWith(`inbox:${recipientAddress.toLowerCase()}`, hash);
    });
  });

  describe('get', () => {
    it("should return the message if it exists in the recipient's inbox", async () => {
      const recipientAddress = recipient.address;
      const hash = message.hash.base58;

      // Mock the Message.from method to return a simple object
      const mockMessage = { type: 'basic', data: 'hello' };

      redis.hget.mockResolvedValue(
        JSON.stringify({
          hash: hash,
          type: 'basic',
          timestamp: message.timestamp.toJSON(),
          sender: sender.address,
          recipient: recipient.address,
          mediaType: 'text/plain',
          size: message.data.length,
          signature: message.signature.base58,
          data: 'base64:' + message.data.base64,
          meta: {},
        }),
      );

      const result = await service.get(recipientAddress, hash);

      expect(result).toBeDefined();
      expect(redis.hget).toHaveBeenCalledWith(`inbox:${recipientAddress.toLowerCase()}`, hash);
    });

    it("should throw an error if the message does not exist in the recipient's inbox", async () => {
      const recipientAddress = recipient.address;
      const hash = message.hash.base58;
      redis.hget.mockResolvedValue(null);

      await expect(service.get(recipientAddress, hash)).rejects.toThrow('message not found');
      expect(redis.hget).toHaveBeenCalledWith(`inbox:${recipientAddress.toLowerCase()}`, hash);
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
      expect(redis.hset.mock.calls[0][0]).toBe(`inbox:${recipientAddress.toLowerCase()}`);
      expect(redis.hset.mock.calls[0][1]).toBe(message.hash.base58);
      expect(JSON.parse(redis.hset.mock.calls[0][2] as string)).toMatchObject({
        hash: message.hash.base58,
        timestamp: message.timestamp.toJSON(),
        sender: expect.any(Object),
        recipient: recipient.address,
        mediaType: 'text/plain',
        size: message.data.length,
        signature: message.signature.base58,
      });

      expect(bucket.put).toHaveBeenCalled();
      expect(bucket.put.mock.calls[0][0]).toBe(message.hash.base58);
      expect(bucket.put.mock.calls[0][1]).toBeInstanceOf(Uint8Array);
    });

    it('should store the message and index in Redis if storage is enabled and embedded', async () => {
      jest.spyOn(config, 'getStorageEmbedMaxSize').mockReturnValue(1024);
      const recipientAddress = recipient.address;

      await service.store(message);

      expect(logger.debug).toHaveBeenCalledWith(`storage: storing message '${message.hash.base58}'`);

      expect(redis.hset).toHaveBeenCalled();
      expect(redis.hset.mock.calls[0][0]).toBe(`inbox:${recipientAddress.toLowerCase()}`);
      expect(redis.hset.mock.calls[0][1]).toBe(message.hash.base58);
      expect(JSON.parse(redis.hset.mock.calls[0][2] as string)).toMatchObject({
        hash: message.hash.base58,
        version: 0,
        type: 'basic',
        meta: {
          description: '',
          title: '',
          type: 'basic',
        },
        timestamp: message.timestamp.toJSON(),
        sender: expect.any(Object),
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

      message = new Message('hello').to(recipient).signWith(sender);

      (message as any).meta = {
        type: 'basic',
        title: '',
        description: '',
        thumbnail: Binary.fromBase58('hello'),
      };

      const thumbnailBucket = module.get<Bucket>('INBOX_THUMBNAIL_BUCKET');
      const thumbnailPutSpy = jest.spyOn(thumbnailBucket, 'put');

      await service.store(message);

      const storedData = JSON.parse(String(redis.hset.mock.calls[0][2]));

      expect(storedData.thumbnail).toBe(true);

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
      redis.hget.mockResolvedValue(
        JSON.stringify({
          hash: message.hash.base58,
          mediaType: 'text/plain',
          meta: {},
          version: 0,
          timestamp: message.timestamp.toJSON(),
          sender: sender.address,
          recipient: recipient.address,
          signature: message.signature.base58,
        }),
      );

      const result = await (service as any).reconstructFromBucket(
        {
          hash: message.hash.base58,
          mediaType: 'text/plain',
          meta: {},
        },
        message.hash.base58,
      );

      expect(result).toBeDefined();
      expect(bucket.get).toHaveBeenCalledWith(message.hash.base58);
    });
  });

  describe('getLastModified', () => {
    it('should return the last modified date', async () => {
      const recipientAddress = recipient.address;
      const now = new Date();
      now.setMilliseconds(0);
      redis.get.mockResolvedValue(now.toISOString());

      const result = await service.getLastModified(recipientAddress);
      expect(result).toEqual(now);
    });

    it('should return epoch date if no last modified date exists', async () => {
      const recipientAddress = recipient.address;
      redis.get.mockResolvedValue(null);

      const result = await service.getLastModified(recipientAddress);
      expect(result).toEqual(new Date(0));
    });
  });
});
