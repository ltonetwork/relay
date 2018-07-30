import { Module } from '@nestjs/common';
import { ConfigLoaderService } from './config-loader.service';
import { ConfigService } from './config.service';
import { LoggerModule } from '../logger/logger.module';

export const ConfigModuleConfig = {
  imports: [LoggerModule],
  controllers: [],
  providers: [ConfigService, ConfigLoaderService],
  exports: [ConfigService, ConfigLoaderService],
};

@Module(ConfigModuleConfig)
export class ConfigModule {}
