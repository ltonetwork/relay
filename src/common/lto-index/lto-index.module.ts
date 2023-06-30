import { Module } from '@nestjs/common';
import { ConfigModule } from '../config/config.module';
import { LtoIndexService } from './lto-index.service';
import { RequestModule } from '../request/request.module';

@Module({
  imports: [ConfigModule, RequestModule],
  providers: [LtoIndexService],
  exports: [LtoIndexService],
})
export class LtoIndexModule {}
