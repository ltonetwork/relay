import { Module, HttpModule } from '@nestjs/common';
import { legalEventsProviders } from './legalevents.providers';
import { LegalEventsService } from './legalevents.service';
import { LoggerModule } from '../logger/logger.module';
import { ConfigModule } from '../config/config.module';

export const LegalEventsModuleConfig = {
  imports: [ConfigModule, LoggerModule, HttpModule],
  controllers: [],
  providers: [
    ...legalEventsProviders,
    LegalEventsService,
  ],
  exports: [
    ...legalEventsProviders,
    LegalEventsService,
  ],
};

@Module(LegalEventsModuleConfig)
export class LegalEventsModule { }
