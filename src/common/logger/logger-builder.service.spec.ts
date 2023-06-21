import { Test } from '@nestjs/testing';
import { LoggerBuilderService } from './logger-builder.service';
import { ConfigService } from '../common/config/config.service';
import * as winston from 'winston';
import TransportStream from 'winston-transport';
import { WINSTON } from '../../constants';
import Mock = jest.Mock;

class TestTransport extends TransportStream {
  logs: string[] = [];

  constructor(options = {}) {
    super(options);
  }

  log(info: any, callback: () => void) {
    const logEntry = info[Symbol.for('message') as any];
    this.logs.push(logEntry);
    callback();
  }
}

const mockConfigService = () => ({
  node: { isEnv: jest.fn().mockImplementation(() => false) },
  app: { name: 'TestApp' },
  log: { level: 'info', force: false },
});

describe('LoggerBuilderService', () => {
  let loggerBuilderService: LoggerBuilderService;
  let configService: ConfigService;
  let testTransport: TestTransport;

  beforeEach(async () => {
    const moduleRef = await Test.createTestingModule({
      providers: [
        LoggerBuilderService,
        { provide: ConfigService, useFactory: mockConfigService },
        { provide: WINSTON, useValue: winston },
      ],
    }).compile();

    loggerBuilderService = moduleRef.get<LoggerBuilderService>(LoggerBuilderService);
    configService = moduleRef.get<ConfigService>(ConfigService);
  });

  beforeEach(() => {
    testTransport = new TestTransport({ format: winston.format.combine(...loggerBuilderService.formats) });
    loggerBuilderService.logger = winston.createLogger({
      level: 'debug',
      transports: [testTransport],
    });
  });

  afterEach(() => {
    jest.resetAllMocks();
  });

  it('should be defined', () => {
    expect(loggerBuilderService).toBeDefined();
    expect(loggerBuilderService.logger).toBeDefined();
  });

  describe('logger output', () => {
    const levels = ['info', 'warn', 'error', 'debug'];

    it.each(levels)('should log correctly with %s level', (level) => {
      const logger = loggerBuilderService.logger;
      const message = 'Test message';
      const meta = { foo: 'bar' };
      const context = 'TestContext';

      logger[level](message, { ...meta, context });

      expect(testTransport.logs.length).toBe(1);
      const logEntry = testTransport.logs[0];

      expect(logEntry).toContain(`[${configService.app.name}]`);
      expect(logEntry).toContain(level.toUpperCase());
      expect(logEntry).toContain(`[${context}]`);
      expect(logEntry).toContain(message);
      expect(logEntry).toContain('foo');
      expect(logEntry).toContain('bar');
    });
  });

  describe('shouldLog', () => {
    it('should return true if not in test environment', () => {
      (configService.node.isEnv as Mock).mockReturnValue(false);
      expect(loggerBuilderService.shouldLog()).toBe(true);
    });

    it('should return false if in test environment and no options provided', () => {
      (configService.node.isEnv as Mock).mockReturnValue(true);
      expect(loggerBuilderService.shouldLog()).toBe(false);
    });

    it('should return true if in test environment and force option is provided', () => {
      (configService.node.isEnv as Mock).mockReturnValue(true);
      expect(loggerBuilderService.shouldLog({ force: true })).toBe(true);
    });

    it('should return true if in test environment and config.log.force is true', () => {
      (configService.node.isEnv as Mock).mockReturnValue(true);
      configService.log.force = true;
      expect(loggerBuilderService.shouldLog()).toBe(true);
    });
  });
});
