import { INestApplication } from '@nestjs/common';
import { Test } from '@nestjs/testing';

import { configureApp } from '../../src/app-setup';
import { AppModule } from '../../src/app.module';
import { PrismaService } from '../../src/prisma/prisma.service';

export interface TestApp {
  app: INestApplication;
  prisma: PrismaService;
  close(): Promise<void>;
}

/**
 * Sobe a aplicação inteira contra a branch de teste do Neon — mesmos módulos,
 * mesmos pipes, mesmo tudo que sobe em produção.
 */
export async function createTestApp(): Promise<TestApp> {
  const moduleRef = await Test.createTestingModule({ imports: [AppModule] }).compile();

  const app = configureApp(moduleRef.createNestApplication());
  await app.init();

  return {
    app,
    prisma: app.get(PrismaService),
    close: () => app.close(),
  };
}
