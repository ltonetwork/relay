import { MiddlewareConsumer, Module, RequestMethod } from '@nestjs/common';
import { AppController } from './app.controller';
import { AppService } from './app.service';
import { ConfigModule } from './common/config/config.module';
import { RabbitMQModule } from './rabbitmq/rabbitmq.module';
import { DispatcherModule } from './dispatcher/dispatcher.module';
import { QueueModule } from './queue/queue.module';
import { InboxModule } from './inbox/inbox.module';
import { VerifySignatureMiddleware } from './common/http-signature/verify-signature.middleware';
import { MessageModule } from './message/message.module';

export const AppModuleConfig = {
  imports: [ConfigModule, RabbitMQModule, QueueModule, DispatcherModule, InboxModule, MessageModule],
  controllers: [AppController],
  providers: [AppService],
};

@Module(AppModuleConfig)
export class AppModule {
  configure(consumer: MiddlewareConsumer) {
    consumer.apply(VerifySignatureMiddleware).forRoutes({ path: 'inboxes/*', method: RequestMethod.ALL });
  }
}
