import { LoggerBuilderService } from './logger-builder.service';
import { Module } from '@nestjs/common';
import { loggerProviders } from './logger.providers';
import { LoggerService } from './logger.service';
import { ConfigModule } from '../config/config.module';

export const LoggerModuleConfig = {
  imports: [ConfigModule],
  controllers: [],
  providers: [...loggerProviders, LoggerBuilderService, LoggerService],
  exports: [...loggerProviders, LoggerBuilderService, LoggerService],
};

@Module(LoggerModuleConfig)
export class LoggerModule {}
