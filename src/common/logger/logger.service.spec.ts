import { Test, TestingModule } from '@nestjs/testing';
import { LoggerModuleConfig } from './logger.module';
import { LoggerService } from './logger.service';

describe('LoggerService', () => {
  let module: TestingModule;
  let loggerService: LoggerService;

  function spy() {
    const logger = {
      log: jest.spyOn(loggerService, 'log'),
    };

    return { logger };
  }

  beforeEach(async () => {
    module = await Test.createTestingModule(LoggerModuleConfig).compile();
    await module.init();

    loggerService = module.get<LoggerService>(LoggerService);
  });

  afterEach(async () => {
    await module.close();
  });

  describe('info()', () => {
    test('should log with info level', async () => {
      const spies = spy();
      spies.logger.log.mockImplementation();

      const message = 'fake_message';
      const meta = { foo: 'bar' };
      loggerService.info(message, meta);

      expect(spies.logger.log.mock.calls.length).toBe(1);
      expect(spies.logger.log.mock.calls[0][0]).toBe('info');
      expect(spies.logger.log.mock.calls[0][1]).toBe(message);
      expect(spies.logger.log.mock.calls[0][2]).toBe(meta);
    });
  });

  describe('warn()', () => {
    test('should log with warn level', async () => {
      const spies = spy();
      spies.logger.log.mockImplementation();

      const message = 'fake_message';
      const meta = { foo: 'bar' };
      loggerService.warn(message, meta);

      expect(spies.logger.log.mock.calls.length).toBe(1);
      expect(spies.logger.log.mock.calls[0][0]).toBe('warn');
      expect(spies.logger.log.mock.calls[0][1]).toBe(message);
      expect(spies.logger.log.mock.calls[0][2]).toBe(meta);
    });
  });

  describe('error()', () => {
    test('should log with error level', async () => {
      const spies = spy();
      spies.logger.log.mockImplementation();

      const message = 'fake_message';
      const meta = { foo: 'bar' };
      loggerService.error(message, meta);

      expect(spies.logger.log.mock.calls.length).toBe(1);
      expect(spies.logger.log.mock.calls[0][0]).toBe('error');
      expect(spies.logger.log.mock.calls[0][1]).toBe(message);
      expect(spies.logger.log.mock.calls[0][2]).toBe(meta);
    });
  });

  describe('debug()', () => {
    test('should log with debug level', async () => {
      const spies = spy();
      spies.logger.log.mockImplementation();

      const message = 'fake_message';
      const meta = { foo: 'bar' };
      loggerService.debug(message, meta);

      expect(spies.logger.log.mock.calls.length).toBe(1);
      expect(spies.logger.log.mock.calls[0][0]).toBe('debug');
      expect(spies.logger.log.mock.calls[0][1]).toBe(message);
      expect(spies.logger.log.mock.calls[0][2]).toBe(meta);
    });
  });
});
