import { MiddlewareConsumer, Module } from '@nestjs/common';
import { AppController } from './app.controller';
import { AppService } from './app.service';
import { ConfigModule } from './common/config/config.module';
import { RabbitMQModule } from './rabbitmq/rabbitmq.module';
import { DispatcherModule } from './dispatcher/dispatcher.module';
import { QueuerModule } from './queuer/queuer.module';
import { InboxModule } from './inbox/inbox.module';
import { VerifySignatureMiddleware } from './common/http-signature/verify-signature.middleware';
import { InboxController } from './inbox/inbox.controller';

export const AppModuleConfig = {
  imports: [
    ConfigModule,
    RabbitMQModule,
    QueuerModule,
    DispatcherModule,
    InboxModule
  ],
  controllers: [AppController],
  providers: [AppService],
};

@Module(AppModuleConfig)
export class AppModule {
  configure(consumer: MiddlewareConsumer) {
    consumer.apply(VerifySignatureMiddleware).forRoutes(InboxController);
  }
}
