import { Module } from '@nestjs/common';
import { AppController } from './app.controller';
import { AppService } from './app.service';
import { ConfigModule } from './config/config.module';
import { LoggerModule } from './logger/logger.module';
import { RabbitMQModule } from './rabbitmq/rabbitmq.module';
import { LegalEventsModule } from './legalevents/legalevents.module';
import { DispatcherModule } from './dispatcher/dispatcher.module';
import { QueuerModule } from './queuer/queuer.module';
import { RequestModule } from './request/request.module';

export const AppModuleConfig = {
  imports: [
    ConfigModule,
    LoggerModule,
    RequestModule,
    RabbitMQModule,
    LegalEventsModule,
    DispatcherModule,
    QueuerModule,
  ],
  controllers: [AppController],
  providers: [AppService],
};

@Module(AppModuleConfig)
export class AppModule { }
