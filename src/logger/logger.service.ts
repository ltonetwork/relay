import { Injectable, Inject, OnModuleInit, OnModuleDestroy } from '@nestjs/common';
import { ConfigService } from '../config/config.service';
import { WINSTON } from '../constants';
import winston from 'winston';

@Injectable()
export class LoggerService implements OnModuleInit, OnModuleDestroy {
  private logger: winston.Logger;

  constructor(
    @Inject(WINSTON) private readonly _winston: typeof winston,
    private readonly config: ConfigService,
  ) { }

  async onModuleInit() {
    this.logger = winston.createLogger({
      transports: [
        new winston.transports.Console({ format: winston.format.simple() }),
        new winston.transports.File({ filename: 'error.log', level: 'error' }),
        new winston.transports.File({ filename: 'combined.log' }),
      ],
    });
  }

  async onModuleDestroy() { }

  info(message: string) {
    this.logger.info(message);
  }

  warn(message: string) {
    this.logger.warn(message);
  }

  error(message: string) {
    this.logger.error(message);
  }
}
