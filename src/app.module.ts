import { MiddlewareConsumer, Module } from '@nestjs/common';
import { AppController } from './app.controller';
import { AppService } from './app.service';
import { ConfigModule } from './common/config/config.module';
import { RabbitMQModule } from './rabbitmq/rabbitmq.module';
import { DispatcherModule } from './dispatcher/dispatcher.module';
import { QueuerModule } from './queuer/queuer.module';
import { StorageModule } from './storage/storage.module';
import { VerifySignatureMiddleware } from './common/http-signature/verify-signature.middleware';
import { StorageController } from './storage/storage.controller';

export const AppModuleConfig = {
  imports: [
    ConfigModule,
    RabbitMQModule,
    QueuerModule,
    DispatcherModule,
    StorageModule
  ],
  controllers: [AppController],
  providers: [AppService],
};

@Module(AppModuleConfig)
export class AppModule {
  configure(consumer: MiddlewareConsumer) {
    consumer.apply(VerifySignatureMiddleware).forRoutes(StorageController);
  }
}
