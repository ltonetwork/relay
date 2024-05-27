// noinspection DuplicatedCode

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
  let config: ConfigService;

  let sender: Account;
  let recipient: Account;
  let message: Message;

  beforeEach(() => {
    redis = {
      hgetall: jest.fn(),
      hexists: jest.fn(),
      hget: jest.fn(),
      hset: jest.fn(),
    } as any;

    bucket = {
      get: jest.fn(),
      put: jest.fn(),
      set: jest.fn(),
    } as any;

    logger = {
      debug: jest.fn(),
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

    it('should index in Redis and the message in the bucket if not embedded', async () => {
      jest.spyOn(config, 'getStorageEmbedMaxSize').mockReturnValue(0);
      const recipientAddress = recipient.address;

      await service.store(message);

      expect(logger.debug).toHaveBeenCalledWith(`storage: storing message '${message.hash.base58}'`);

      expect(redis.hset).toHaveBeenCalled();
      expect(redis.hset.mock.calls[0][0]).toBe(`inbox:${recipientAddress}`);
      expect(redis.hset.mock.calls[0][1]).toBe(message.hash.base58);
      expect(JSON.parse(redis.hset.mock.calls[0][2] as string)).toEqual({
        hash: message.hash.base58,
        type: 'basic',
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
        type: 'basic',
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
  });
});
