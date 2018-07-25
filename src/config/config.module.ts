import { Module } from '@nestjs/common';
import { ConfigLoaderService } from './config-loader.service';
import { ConfigService } from './config.service';

export const ConfigModuleConfig = {
  imports: [],
  controllers: [],
  providers: [ConfigService, ConfigLoaderService],
  exports: [ConfigService, ConfigLoaderService],
};

@Module(ConfigModuleConfig)
export class ConfigModule { }
