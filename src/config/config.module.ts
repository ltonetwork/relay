import { Module } from '@nestjs/common';
import { ConfigService } from './config.service';

export const ConfigModuleConfig = {
  imports: [],
  controllers: [],
  providers: [ConfigService],
  exports: [ConfigService],
};

@Module(ConfigModuleConfig)
export class ConfigModule { }
