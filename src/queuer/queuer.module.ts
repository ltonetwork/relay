import { Module } from '@nestjs/common';
import { QueuerService } from './queuer.service';
import { QueuerController } from './queuer.controller';
import { LoggerModule } from '../common/logger/logger.module';
import { ConfigModule } from '../common/config/config.module';
import { RabbitMQModule } from '../rabbitmq/rabbitmq.module';
import { DidResolverModule } from '../common/did-resolver/did-resolver.module';

@Module({
  imports: [LoggerModule, ConfigModule, RabbitMQModule, DidResolverModule],
  controllers: [QueuerController],
  providers: [QueuerService],
  exports: [QueuerService],
})
export class QueuerModule {}
