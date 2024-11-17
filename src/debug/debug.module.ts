import { Module } from '@nestjs/common';
import { DebugController } from './debug.controller';
import { DebugService } from './debug.service';
import { RedisModule } from '../common/redis/redis.module';
import { LoggerModule } from '../common/logger/logger.module';

@Module({
  imports: [RedisModule, LoggerModule],
  controllers: [DebugController],
  providers: [DebugService],
})
export class DebugModule {}
