import { Module, HttpModule } from '@nestjs/common';
import { legalEventsProviders } from './legalevents.providers';
import { LegalEventsService } from './legalevents.service';
import { ConfigModule } from '../config/config.module';

export const LegalEventsModuleConfig = {
  imports: [ConfigModule, HttpModule],
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
