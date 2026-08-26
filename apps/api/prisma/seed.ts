import { PrismaClient } from '@prisma/client';
import * as argon2 from 'argon2';
import { config as loadEnv } from 'dotenv';

loadEnv();

/**
 * Seed de desenvolvimento: o mínimo para o front ter em quem entrar.
 *
 * Uma conta, o Engenheiro Responsável (que é o dono), uma empresa cliente e o
 * Gestor dela. Não é o elenco inteiro da documentação de propósito — quem
 * precisa do elenco completo são os testes, e lá ele é montado do zero a cada
 * caso ([test/helpers/elenco.ts](../test/helpers/elenco.ts)).
 */

const prisma = new PrismaClient();

const SENHA = process.env.SEED_PASSWORD ?? 'normatiza-dev-123';

async function main() {
  if (process.env.NODE_ENV === 'production') {
    throw new Error('O seed é de desenvolvimento e não roda em produção.');
  }

  const passwordHash = await argon2.hash(SENHA, { type: argon2.argon2id });

  const conta = await prisma.account.upsert({
    where: { document: '11.111.111/0001-11' },
    update: {},
    create: { name: 'Normatiza', document: '11.111.111/0001-11' },
  });

  const brf = await prisma.company.upsert({
    where: { accountId_document: { accountId: conta.id, document: '22.222.222/0001-22' } },
    update: {},
    create: {
      accountId: conta.id,
      corporateName: 'BRF S.A.',
      tradeName: 'BRF',
      document: '22.222.222/0001-22',
    },
  });

  const josué = await prisma.user.upsert({
    where: { accountId_email: { accountId: conta.id, email: 'josue@normatiza.com' } },
    update: {},
    create: {
      accountId: conta.id,
      name: 'Josué',
      email: 'josue@normatiza.com',
      status: 'ACTIVE',
      passwordHash,
      passwordAlgo: 'ARGON2ID',
      emailConfirmedAt: new Date(),
      registryType: 'CREA',
      registryNumber: 'CREA-SP 000000',
    },
  });

  await prisma.account.update({
    where: { id: conta.id },
    data: { ownerUserId: josué.id },
  });

  const marcos = await prisma.user.upsert({
    where: { accountId_email: { accountId: conta.id, email: 'marcos@brf.com' } },
    update: {},
    create: {
      accountId: conta.id,
      name: 'Marcos',
      email: 'marcos@brf.com',
      status: 'ACTIVE',
      passwordHash,
      passwordAlgo: 'ARGON2ID',
      emailConfirmedAt: new Date(),
      invitedByUserId: josué.id,
      jobTitle: 'Coordenador de SST',
    },
  });

  for (const [user, roles] of [
    [josué, ['LEAD_ENGINEER'] as const],
    [marcos, ['MANAGER'] as const],
  ] as const) {
    await prisma.membership.upsert({
      where: { userId_companyId: { userId: user.id, companyId: brf.id } },
      update: {},
      create: {
        accountId: conta.id,
        userId: user.id,
        companyId: brf.id,
        roles: [...roles],
      },
    });
  }

  // O Josué é dono da consultoria **e** dono da plataforma — um login só, com o
  // Contexto 0 sobreposto. É o caso real do produto, e é o que o seed reproduz.
  await prisma.platformAdmin.upsert({
    where: { userId: josué.id },
    update: { revokedAt: null },
    create: { userId: josué.id },
  });

  console.log('Seed pronto.');
  console.log(`  Eng. Responsável + Admin da Plataforma: josue@normatiza.com`);
  console.log(`  Gestor da BRF:                         marcos@brf.com`);
  console.log(`  Senha dos dois:                        ${SENHA}`);
}

main()
  .catch((e) => {
    console.error(e);
    process.exitCode = 1;
  })
  .finally(() => prisma.$disconnect());
