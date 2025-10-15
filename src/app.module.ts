import { MiddlewareConsumer, Module, RequestMethod } from '@nestjs/common';
import { AppController } from './app.controller';
import { AppService } from './app.service';
import { ConfigModule } from './common/config/config.module';
import { LoggerModule } from './common/logger/logger.module';
import { RedisModule } from './common/redis/redis.module';
import { RabbitMQModule } from './rabbitmq/rabbitmq.module';
import { DispatcherModule } from './dispatcher/dispatcher.module';
import { QueueModule } from './queue/queue.module';
import { InboxModule } from './inbox/inbox.module';
import { SIWEModule } from './common/siwe/siwe.module';
import { SIWEAuthMiddleware } from './common/siwe/siwe-auth.middleware';

export const AppModuleConfig = {
  imports: [
    ConfigModule,
    LoggerModule,
    RedisModule,
    RabbitMQModule,
    QueueModule,
    DispatcherModule,
    InboxModule,
    SIWEModule,
  ],
  controllers: [AppController],
  providers: [AppService],
};

@Module(AppModuleConfig)
export class AppModule {
  configure(consumer: MiddlewareConsumer) {
    consumer
      .apply(SIWEAuthMiddleware)
      .forRoutes(
        { path: 'inboxes/*', method: RequestMethod.ALL },
        { path: 'messages/*', method: RequestMethod.GET },
        { path: 'messages/*', method: RequestMethod.DELETE },
      );
  }
}
