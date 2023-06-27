import { Module } from '@nestjs/common';
import { AppController } from './app.controller';
import { AppService } from './app.service';
import { ConfigModule } from './common/config/config.module';
import { LoggerModule } from './common/logger/logger.module';
import { RabbitMQModule } from './rabbitmq/rabbitmq.module';
import { DispatcherModule } from './dispatcher/dispatcher.module';
import { QueuerModule } from './queuer/queuer.module';
import { RequestModule } from './common/request/request.module';

export const AppModuleConfig = {
  imports: [LoggerModule, ConfigModule, RequestModule, RabbitMQModule, DispatcherModule, QueuerModule],
  controllers: [AppController],
  providers: [AppService],
};

@Module(AppModuleConfig)
export class AppModule {}
