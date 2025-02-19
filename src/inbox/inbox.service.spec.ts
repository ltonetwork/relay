// noinspection DuplicatedCode

import { Test, TestingModule } from '@nestjs/testing';
import { InboxService } from './inbox.service';
import { ConfigModule } from '../common/config/config.module';
import { LoggerService } from '../common/logger/logger.service';
import Redis from 'ioredis';
import { Bucket } from 'any-bucket';
import { Message, AccountFactoryED25519, Account } from '@ltonetwork/lto';
import { ConfigService } from '../common/config/config.service';
import { TelegramService } from '../common/telegram/telegram.service';

describe('InboxService', () => {
  let module: TestingModule;

  let service: InboxService;
  let redis: jest.Mocked<Redis>;
  let bucket: jest.Mocked<Bucket>;
  let logger: jest.Mocked<LoggerService>;
  let config: jest.Mocked<ConfigService>;
  let telegramService: jest.Mocked<TelegramService>;
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
      set: jest.fn(),
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

    telegramService = {
      formatMessageForTelegram: jest.fn(),
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

    it('should return all messages if no type is specified', async () => {
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
      expect(telegramService.formatMessageForTelegram).toHaveBeenCalledWith(message);
    });

    it('should store the message in the bucket if not embedded', async () => {
      jest.spyOn(config, 'getStorageEmbedMaxSize').mockReturnValue(0);
      redis.hexists.mockResolvedValue(0);

      await service.store(message);

      expect(bucket.put).toHaveBeenCalledWith(message.hash.base58, expect.any(Uint8Array));
      expect(redis.hset).toHaveBeenCalled();
      expect(telegramService.formatMessageForTelegram).toHaveBeenCalledWith(message);
    });
  });

  describe('updateLastModified', () => {
    it('should update the last modified timestamp in Redis', async () => {
      await service.updateLastModified(recipient.address);

      expect(redis.set).toHaveBeenCalledWith(`inbox:${recipient.address}:lastModified`, expect.any(String));
    });
  });

  describe('getMessagesMetadata', () => {
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

    it('should return all messages without the data field', async () => {
      const recipientAddress = recipient.address;
      redis.hgetall.mockResolvedValue(data);

      const result = await service.getMessagesMetadata(recipientAddress);

      expect(result).toEqual([
        {
          hash: 'hash1',
          type: 'basic',
          timestamp: 1672531200,
          sender: 'sender1',
          recipient: 'recipient1',
          size: 10,
        },
        {
          hash: 'hash2',
          type: 'other',
          timestamp: 1672531210,
          sender: 'sender2',
          recipient: 'recipient2',
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

    it('should sort messages by timestamp in descending order', async () => {
      const recipientAddress = recipient.address;
      redis.hgetall.mockResolvedValue({
        hash1: JSON.stringify({
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
        }),
        hash2: JSON.stringify({
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
        }),
        hash3: JSON.stringify({
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
        }),
      });

      const result = await service.getMessagesMetadata(recipientAddress);
      console.log(result);

      expect(result).toEqual([
        {
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
        },
        {
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
        },
        {
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
        },
      ]);
    });

    it('should throw an error if Redis fails', async () => {
      const recipientAddress = recipient.address;
      redis.hgetall.mockRejectedValue(new Error('Redis error'));

      await expect(service.getMessagesMetadata(recipientAddress)).rejects.toThrow(
        'Failed to retrieve message metadata',
      );
    });
  });
});
