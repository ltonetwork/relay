import { Module } from '@nestjs/common';
import { DidResolverService } from './did-resolver.service';
import { RequestModule } from '../request/request.module';
import { ConfigModule } from '../config/config.module';

@Module({
  imports: [RequestModule, ConfigModule],
  providers: [DidResolverService],
  exports: [DidResolverService],
})
export class DidResolverModule {}
