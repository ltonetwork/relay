import { Injectable, Inject, OnModuleInit, OnModuleDestroy } from '@nestjs/common';
import { WINSTON } from '../constants';
import winston from 'winston';
import moment from 'moment';
import util from 'util';

@Injectable()
export class LoggerService implements OnModuleInit, OnModuleDestroy {
  private logger: winston.Logger;

  constructor(
    @Inject(WINSTON) private readonly _winston: typeof winston,
  ) { }

  async onModuleInit() {
    const formats = [
      winston.format.timestamp(),
      winston.format.printf((info) => {
        const msg = [
          `[${moment(info.timestamp).format()}] - ${info.level}: ${info.message}`,
        ];

        for (const key in info) {
          if (['timestamp', 'message', 'level'].indexOf(key) > -1) {
            continue;
          }

          const value = util.isString(info[key]) ? info[key] : JSON.stringify(info[key], null, 2);
          msg.push(`\n${key}:\n${value}\n`);
        }

        return msg.join('\n');
      }),
    ];

    this.logger = winston.createLogger({
      transports: [
        new winston.transports.Console({
          format: winston.format.combine(
            ...[winston.format.colorize()],
            ...formats,
          ),
        }),
        new winston.transports.File({
          format: winston.format.combine(...formats),
          filename: 'error.log',
          level: 'error',
        }),
        new winston.transports.File({
          format: winston.format.combine(...formats),
          filename: 'combined.log',
          handleExceptions: true,
        }),
      ],
    });
  }

  async onModuleDestroy() { }

  info(message: string, meta?: any) {
    this.logger.info(message, meta);
  }

  warn(message: string, meta?: any) {
    this.logger.warn(message, meta);
  }

  error(message: string, meta?: any) {
    this.logger.error(message, meta);
  }
}
