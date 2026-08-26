import { INestApplication, ValidationPipe } from '@nestjs/common';
import * as cookieParser from 'cookie-parser';

/**
 * Tudo que a aplicação precisa além dos módulos. Vive aqui, e não no `main.ts`,
 * para que a suíte e2e exercite **a mesma** aplicação que sobe em produção —
 * um pipe de validação que só existe em produção é um bug que teste nenhum pega.
 */
export function configureApp(app: INestApplication): INestApplication {
  // O refresh token viaja em cookie httpOnly no web (D5).
  app.use(cookieParser());

  app.useGlobalPipes(
    new ValidationPipe({ whitelist: true, forbidNonWhitelisted: true, transform: true }),
  );

  return app;
}
