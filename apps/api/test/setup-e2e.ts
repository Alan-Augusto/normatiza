import { config as loadEnv } from 'dotenv';
import { PrismaClient } from '@prisma/client';

import { resetDatabase } from './reset-db';

loadEnv();
process.env.NODE_ENV = 'test';

if (!process.env.TEST_DATABASE_URL) {
  throw new Error(
    'TEST_DATABASE_URL não definida. A suíte e2e trunca todas as tabelas — ela ' +
      'exige a branch de teste do Neon, nunca o banco de desenvolvimento.',
  );
}

if (process.env.TEST_DATABASE_URL === process.env.DATABASE_URL) {
  throw new Error(
    'TEST_DATABASE_URL é igual à DATABASE_URL. Rodar a suíte assim apagaria o ' +
      'banco de desenvolvimento.',
  );
}

const prisma = new PrismaClient({
  datasources: { db: { url: process.env.TEST_DATABASE_URL } },
});

// Antes de cada teste, e não depois: um teste que quebra no meio deixa o banco
// sujo, e limpar na entrada garante que o próximo comece do zero de qualquer jeito.
beforeEach(async () => {
  await resetDatabase(prisma);
});

afterAll(async () => {
  await prisma.$disconnect();
});
