import { Module } from '@nestjs/common';
import { MessageController } from './message.controller';
import { MessageService } from './message.service';
import { MessageGateway } from './message.gateway';
import { RedisModule } from '../common/redis/redis.module';
import { LoggerModule } from '../common/logger/logger.module';

@Module({
  imports: [RedisModule, LoggerModule],
  controllers: [MessageController],
  providers: [MessageService, MessageGateway],
})
export class MessageModule {}
