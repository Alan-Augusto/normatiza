import { Logger, ValidationPipe } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { NestFactory } from '@nestjs/core';
import * as cookieParser from 'cookie-parser';

import { AppModule } from './app.module';
import { EnvironmentVariables } from './config/env.validation';

async function bootstrap() {
  const app = await NestFactory.create(AppModule);

  // O refresh token viaja em cookie httpOnly no web (D5).
  app.use(cookieParser());

  // DTOs decorados com class-validator valem em toda rota; `whitelist` descarta
  // campo não declarado em vez de deixá-lo chegar ao serviço.
  app.useGlobalPipes(
    new ValidationPipe({ whitelist: true, forbidNonWhitelisted: true, transform: true }),
  );

  // `credentials` é o que permite o cookie do refresh token atravessar a origem
  // do front. A lista de origens permitidas entra junto com a autenticação.
  app.enableCors({ credentials: true, origin: true });

  const config = app.get(ConfigService<EnvironmentVariables, true>);
  const port = config.get('PORT', { infer: true });

  await app.listen(port);
  Logger.log(`API ouvindo em http://localhost:${port}`, 'Bootstrap');
}

bootstrap();
