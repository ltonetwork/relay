import { Module } from '@nestjs/common';
import { DidResolverService } from './did-resolver.service';
import { RequestModule } from '../request/request.module';
import { ConfigModule } from '../config/config.module';
import { LoggerModule } from '../logger/logger.module';

@Module({
  imports: [RequestModule, ConfigModule, LoggerModule],
  providers: [DidResolverService],
  exports: [DidResolverService],
})
export class DidResolverModule {}
