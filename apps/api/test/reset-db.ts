import { PrismaClient } from '@prisma/client';

/**
 * Trunca todas as tabelas do schema `public`, exceto o histórico de migrações.
 *
 * É deliberadamente genérico (lê o catálogo do Postgres em vez de listar models):
 * cada tabela nova entra na limpeza sozinha, sem que ninguém precise lembrar de
 * atualizar esta lista. `RESTART IDENTITY CASCADE` zera sequências e ignora a
 * ordem das FKs.
 */
export async function resetDatabase(prisma: PrismaClient): Promise<void> {
  const tables = await prisma.$queryRaw<{ tablename: string }[]>`
    SELECT tablename FROM pg_tables
    WHERE schemaname = 'public' AND tablename <> '_prisma_migrations'
  `;

  if (tables.length === 0) return;

  const alvo = tables.map((t) => `"public"."${t.tablename}"`).join(', ');
  await prisma.$executeRawUnsafe(`TRUNCATE TABLE ${alvo} RESTART IDENTITY CASCADE`);
}
