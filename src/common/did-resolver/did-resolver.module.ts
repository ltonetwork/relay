import { Module } from '@nestjs/common';
import { DidResolverService } from './did-resolver.service';

@Module({
  providers: [DidResolverService]
})
export class DidResolverModule {}
