import { Test, TestingModule } from '@nestjs/testing';
import { DebugController } from './debug.controller';
import { DebugService } from './debug.service';
import { ForbiddenException, NotFoundException } from '@nestjs/common';

describe('DebugController', () => {
  let controller: DebugController;
  let debugServiceMock: Partial<DebugService>;

  beforeEach(async () => {
    debugServiceMock = {
      hasMessage: jest.fn(),
      deleteMessage: jest.fn(),
      isValidCode: jest.fn(),
    };

    const module: TestingModule = await Test.createTestingModule({
      controllers: [DebugController],
      providers: [{ provide: DebugService, useValue: debugServiceMock }],
    }).compile();

    controller = module.get<DebugController>(DebugController);
  });

  it('should be defined', () => {
    expect(controller).toBeDefined();
  });

  describe('delete', () => {
    it('should delete a message with a valid code', async () => {
      (debugServiceMock.isValidCode as jest.Mock).mockResolvedValueOnce(true);
      (debugServiceMock.hasMessage as jest.Mock).mockResolvedValueOnce(true);

      await expect(controller.delete('testAddress', 'testHash', 'valid-code')).resolves.toBeUndefined();

      expect(debugServiceMock.isValidCode).toHaveBeenCalledWith('valid-code');
      expect(debugServiceMock.hasMessage).toHaveBeenCalledWith('testAddress', 'testHash');
      expect(debugServiceMock.deleteMessage).toHaveBeenCalledWith('testAddress', 'testHash');
    });

    it('should throw ForbiddenException if the code is invalid', async () => {
      (debugServiceMock.isValidCode as jest.Mock).mockResolvedValueOnce(false);

      await expect(controller.delete('testAddress', 'testHash', 'invalid-code')).rejects.toThrow(ForbiddenException);

      expect(debugServiceMock.isValidCode).toHaveBeenCalledWith('invalid-code');
      expect(debugServiceMock.deleteMessage).not.toHaveBeenCalled();
    });

    it('should throw NotFoundException if the message does not exist', async () => {
      (debugServiceMock.isValidCode as jest.Mock).mockResolvedValueOnce(true);
      (debugServiceMock.hasMessage as jest.Mock).mockResolvedValueOnce(false);

      await expect(controller.delete('testAddress', 'testHash', 'valid-code')).rejects.toThrow(NotFoundException);

      expect(debugServiceMock.hasMessage).toHaveBeenCalledWith('testAddress', 'testHash');
      expect(debugServiceMock.deleteMessage).not.toHaveBeenCalled();
    });
  });
});
