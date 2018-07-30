import { Module } from '@nestjs/common';
import { loggerProviders } from './logger.providers';
import { LoggerService } from './logger.service';

export const LoggerModuleConfig = {
  imports: [],
  controllers: [],
  providers: [
    ...loggerProviders,
    LoggerService,
  ],
  exports: [
    ...loggerProviders,
    LoggerService,
  ],
};

@Module(LoggerModuleConfig)
export class LoggerModule { }
