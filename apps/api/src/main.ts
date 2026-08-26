import { Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { NestFactory } from '@nestjs/core';

import { configureApp } from './app-setup';
import { AppModule } from './app.module';
import { EnvironmentVariables } from './config/env.validation';

async function bootstrap() {
  const app = configureApp(await NestFactory.create(AppModule));

  // `credentials` é o que permite o cookie do refresh token atravessar a origem
  // do front. A lista de origens permitidas entra junto com a autenticação.
  app.enableCors({ credentials: true, origin: true });

  const config = app.get(ConfigService<EnvironmentVariables, true>);
  const port = config.get('PORT', { infer: true });

  await app.listen(port);
  Logger.log(`API ouvindo em http://localhost:${port}`, 'Bootstrap');
}

bootstrap();
