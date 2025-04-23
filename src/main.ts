import { NestFactory } from '@nestjs/core';
import { AppModule } from './app.module';
import { INestApplication } from '@nestjs/common';
import { DocumentBuilder, SwaggerModule } from '@nestjs/swagger';
import { ConfigService } from './common/config/config.service';
import { LoggerService } from './common/logger/logger.service';
import * as bodyParser from 'body-parser';
import compression from 'compression';

function swagger(app: INestApplication, config: ConfigService) {
  const options = new DocumentBuilder()
    .setTitle('LTO Network Relay')
    .setDescription(config.app.description)
    .setVersion(config.app.version !== '0.0.0' ? config.app.version : process.env.NODE_ENV)
    .build();

  const document = SwaggerModule.createDocument(app, options);
  SwaggerModule.setup('/api-docs', app, document);
}

async function bootstrap() {
  const app = await NestFactory.create(AppModule, { bodyParser: false });
  const config = app.get<ConfigService>(ConfigService);

  if (config.getApiPrefix()) app.setGlobalPrefix(config.getApiPrefix());

  app.use(compression());

  app.use(bodyParser.json({ limit: '128mb' }));
  app.use(bodyParser.raw({ type: 'application/octet-stream', limit: '128mb' }));

  app.enableCors();

  swagger(app, config);
  app.enableShutdownHooks();

  const logger = app.get<LoggerService>(LoggerService).build('App');
  logger.info(`running on http://localhost:${config.getPort()}`);
  logger.info(`using env ${config.getEnv()}`);

  await app.listen(config.getPort());
}

bootstrap().catch((error) => {
  console.error(error);
  process.exit(1);
});
