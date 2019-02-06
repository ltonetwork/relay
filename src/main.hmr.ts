import { NestFactory } from '@nestjs/core';
import { AppModule } from './app.module';
import { DispatcherService } from './dispatcher/dispatcher.service';
import { json } from 'body-parser';

declare const module: any;

async function bootstrap() {
  const app = await NestFactory.create(AppModule);
  app.use(json({ limit: '5mb' }));
  await app.listen(process.env.PORT || 3000);

  const dispatcherService = app.get<DispatcherService>(DispatcherService);
  await dispatcherService.start();

  if (module.hot) {
    module.hot.accept();
    module.hot.dispose(() => app.close());
  }
}
bootstrap();
