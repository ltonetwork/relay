import { Module } from '@nestjs/common';
import { DebugService } from './debug.service';
import { DebugController } from './debug.controller';
import { RedisModule } from '../common/redis/redis.module';
import { TelegramService } from '../common/telegram/telegram.service';
import { DebugScheduler } from './debugScheduler.service';
import { ConfigModule } from '../common/config/config.module';

@Module({
  imports: [RedisModule, ConfigModule],
  controllers: [DebugController],
  providers: [DebugService, DebugScheduler, TelegramService],
})
export class DebugModule {}
