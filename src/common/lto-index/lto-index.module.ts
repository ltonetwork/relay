import { HttpModule } from '@nestjs/axios';
import { Module } from '@nestjs/common';
import { ConfigModule } from '../config/config.module';
import { LtoIndexService } from './lto-index.service';

@Module({
  imports: [ConfigModule, HttpModule],
  providers: [LtoIndexService],
  exports: [LtoIndexService],
})
export class LtoIndexModule {}
