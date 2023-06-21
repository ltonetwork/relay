import { LoggerBuilderService } from './logger-builder.service';
import { Injectable, Optional } from '@nestjs/common';
import { pascalCase } from '../../utils/transform-case';

interface LoggerOptionsInterface {
  force?: boolean;
}

@Injectable()
export class LoggerService {
  constructor(private readonly loggerBuilder: LoggerBuilderService, @Optional() private readonly context?: string) {}

  build(context?: string | object) {
    if (typeof context === 'function') {
      context = context.name;
    } else if (typeof context === 'object') {
      context = Object.getPrototypeOf(context).constructor.name;
    }

    return new LoggerService(this.loggerBuilder, pascalCase(context as string));
  }

  info(message: string, meta?: any, options?: LoggerOptionsInterface): void {
    this.log('info', message, meta, options);
  }

  warn(message: string, meta?: any, options?: LoggerOptionsInterface): void {
    this.log('warn', message, meta, options);
  }

  error(message: string, meta?: any, options?: LoggerOptionsInterface): void {
    this.log('error', message, meta, options);
  }

  debug(message: string, meta?: any, options?: LoggerOptionsInterface): void {
    this.log('debug', message, meta, options);
  }

  log(level: string, message: string, meta?: any, options?: LoggerOptionsInterface): void {
    if (!this.loggerBuilder.shouldLog(options)) return;

    const logger = this.loggerBuilder.logger;
    logger[level](message, {
      ...meta,
      context: this.context || LoggerService.name,
    });
  }
}
