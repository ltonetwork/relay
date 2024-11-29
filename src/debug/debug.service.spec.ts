import { Test, TestingModule } from '@nestjs/testing';
import Redis from 'ioredis';
import { DebugService } from './debug.service';
import { TelegramService } from '../common/telegram/telegram.service';

jest.mock('ioredis');

describe('DebugService', () => {
  let service: DebugService;
  let redisMock: jest.Mocked<Redis>;
  let telegramServiceMock: jest.Mocked<TelegramService>;

  beforeEach(async () => {
    redisMock = new Redis() as jest.Mocked<Redis>;
    telegramServiceMock = {
      sendMessage: jest.fn(),
    } as Partial<jest.Mocked<TelegramService>> as jest.Mocked<TelegramService>;

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        DebugService,
        { provide: Redis, useValue: redisMock },
        { provide: TelegramService, useValue: telegramServiceMock },
      ],
    }).compile();

    service = module.get<DebugService>(DebugService);
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });

  describe('generateValidationCode', () => {
    it('should generate a validation code and send it via Telegram', async () => {
      redisMock.set.mockResolvedValueOnce('OK');
      telegramServiceMock.sendMessage.mockResolvedValueOnce();

      await service.generateValidationCode();

      expect(redisMock.set).toHaveBeenCalledWith('debug:validationCode', expect.any(String), 'EX', 3600);
      expect(telegramServiceMock.sendMessage).toHaveBeenCalledWith(expect.stringContaining('Code:'));
    });
  });

  describe('isValidCode', () => {
    it('should return true if the code matches the stored code', async () => {
      redisMock.get.mockResolvedValueOnce('valid-code');

      const isValid = await service.isValidCode('valid-code');
      expect(isValid).toBe(true);
    });

    it('should return false if the code does not match', async () => {
      redisMock.get.mockResolvedValueOnce('valid-code');

      const isValid = await service.isValidCode('invalid-code');
      expect(isValid).toBe(false);
    });
  });

  describe('deleteMessage', () => {
    it('should delete a message if it exists', async () => {
      redisMock.hexists.mockResolvedValueOnce(1);
      redisMock.hdel.mockResolvedValueOnce(1);

      await expect(service.deleteMessage('testRecipient', 'testHash')).resolves.toBeUndefined();

      expect(redisMock.hexists).toHaveBeenCalledWith('inbox:testRecipient', 'testHash');
      expect(redisMock.hdel).toHaveBeenCalledWith('inbox:testRecipient', 'testHash');
    });

    it('should throw an error if the message does not exist', async () => {
      redisMock.hexists.mockResolvedValueOnce(0);

      await expect(service.deleteMessage('testRecipient', 'testHash')).rejects.toThrowError('Message not found');

      expect(redisMock.hdel).not.toHaveBeenCalled();
    });
  });
});
