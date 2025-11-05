jest.mock('eqty-core', () => ({
  Message: class MockMessage {
    [key: string]: any;

    static from(data: any) {
      const msg = new MockMessage();
      Object.assign(msg, data);
      return msg;
    }
    static fromJSON(_json: any) {
      return new MockMessage();
    }
    toJSON() {
      const self = this as any;
      let dataValue = self.data || 'hello';
      if (Buffer.isBuffer(dataValue)) {
        dataValue = dataValue.toString('base64');
      }
      return {
        version: self.version || 3,
        meta: self.meta || { type: 'basic' },
        mediaType: self.mediaType || 'text/plain',
        data: dataValue,
        timestamp: self.timestamp?.toISOString() || new Date().toISOString(),
        sender: self.sender,
        recipient: self.recipient,
        signature: self.signature?.base58 || 'mockSig',
        hash: self.hash?.base58 || 'mockHash',
      };
    }
    toBinary() {
      return new Uint8Array([1, 2, 3]);
    }
  },
  Binary: class MockBinary {
    [key: string]: any;

    constructor(_data: any) {}
    get base64() {
      return 'aGVsbG8=';
    }
    static fromBase58(_data: string) {
      return new MockBinary(_data);
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
import { ConfigService } from '../common/config/config.service';

describe('InboxService', () => {
  let module: TestingModule;

  let service: InboxService;
  let redis: jest.Mocked<Redis>;
  let bucket: jest.Mocked<Bucket>;
  let logger: jest.Mocked<LoggerService>;
  let config: ConfigService;

  let sender: { address: string };
  let recipient: { address: string };
  let message: any;

  beforeEach(() => {
    redis = {
      hgetall: jest.fn(),
      hexists: jest.fn(),
      hget: jest.fn(),
      hset: jest.fn(),
      hkeys: jest.fn(),
      set: jest.fn(),
      get: jest.fn(),
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
    sender = { address: '0x1234567890123456789012345678901234567890' };
    recipient = { address: '0x0987654321098765432109876543210987654321' };

    const messageData = Buffer.from('hello');
    message = {
      hash: { base58: 'mockHash123' },
      meta: { type: 'basic' },
      sender: sender.address,
      recipient: recipient.address,
      signature: { base58: 'mockSig123' },
      timestamp: new Date(),
      mediaType: 'text/plain',
      data: messageData,
      version: 3,
      toJSON() {
        const self = this as any;
        let dataValue = self.data || 'hello';
        if (Buffer.isBuffer(dataValue)) {
          dataValue = dataValue.toString('base64');
        }
        return {
          version: self.version || 3,
          meta: self.meta || { type: 'basic' },
          mediaType: self.mediaType || 'text/plain',
          data: dataValue,
          timestamp: self.timestamp?.toISOString() || new Date().toISOString(),
          sender: self.sender,
          recipient: self.recipient,
          signature: self.signature?.base58 || 'mockSig123',
          hash: self.hash?.base58 || 'mockHash123',
        };
      },
      verifyHash: () => true,
      isSigned: () => true,
      verifySignature: async () => true,
    };
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

    it('should return filtered messages by type if type is specified', async () => {
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

    it('should index in Redis and the message in the bucket if not embedded', async () => {
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
        sender: sender.address, // Ethereum address is a string
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
        meta: { type: 'basic' }, // Type is in meta, not at root
        timestamp: message.timestamp.toJSON(),
        sender: sender.address, // Ethereum address is a string
        recipient: recipient.address,
        mediaType: 'text/plain',
        size: message.data.length,
        data: Buffer.from(message.data).toString('base64'), // Embedded data should be base64 encoded (from toJSON)
        signature: message.signature.base58,
      });

      expect(bucket.put).not.toHaveBeenCalled();
    });
  });
});
