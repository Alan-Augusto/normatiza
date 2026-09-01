import { PrismaClient } from '@prisma/client';
import { config as loadEnv } from 'dotenv';

import { PasswordService } from '../src/auth/password.service';

loadEnv();

/**
 * Concede acesso ao Contexto 0.
 *
 * Existe como comando, e não como convite, de propósito: o convite é a porta do
 * **produto** — quem entra por ele entra numa consultoria, com papéis e
 * empresas. A plataforma não é uma consultoria. Abrir um caminho no `CAN_INVITE`
 * para conceder acesso de plataforma daria ao teto de papel — hoje uma tabela
 * fechada e auditável — uma aresta que leva ao topo.
 *
 * Também é o *break-glass*: se a última concessão for revogada por engano, ou o
 * usuário que a carregava for desativado, é por aqui que se recupera o acesso
 * sem abrir o banco na mão.
 *
 * Uso:
 *   pnpm admin:create --email josue@email.com
 *   pnpm admin:create --email josue@email.com --conta 11.111.111/0001-11
 *   pnpm admin:create --email suporte@normatiza.com --criar --nome "Suporte" --senha "…"
 *   pnpm admin:create --listar
 */

const prisma = new PrismaClient();

function arg(nome: string): string | undefined {
  const i = process.argv.indexOf(`--${nome}`);
  return i === -1 ? undefined : process.argv[i + 1];
}

const flag = (nome: string) => process.argv.includes(`--${nome}`);

/** A conta que hospeda admins que não pertencem a consultoria nenhuma. */
const CONTA_DA_PLATAFORMA = {
  name: 'Normatiza (plataforma)',
  document: 'PLATAFORMA',
};

async function listar() {
  const admins = await prisma.platformAdmin.findMany({
    include: { user: { include: { account: true } } },
    orderBy: { grantedAt: 'asc' },
  });

  if (admins.length === 0) {
    console.log('Nenhum admin da plataforma. Use --email para conceder o primeiro.');
    return;
  }

  for (const a of admins) {
    const estado = a.revokedAt ? `revogado em ${a.revokedAt.toISOString().slice(0, 10)}` : 'ativo';
    console.log(`  ${a.user.email.padEnd(34)} ${a.user.account.name.padEnd(24)} ${estado}`);
  }
}

async function criarUsuário(email: string) {
  const nome = arg('nome');
  const senha = arg('senha');

  if (!nome || !senha) {
    throw new Error('--criar exige --nome e --senha.');
  }

  const conta = await prisma.account.upsert({
    where: { document: CONTA_DA_PLATAFORMA.document },
    update: {},
    create: CONTA_DA_PLATAFORMA,
  });

  return prisma.user.create({
    data: {
      accountId: conta.id,
      name: nome,
      email,
      status: 'ACTIVE',
      passwordHash: await new PasswordService().hash(senha),
      passwordAlgo: 'ARGON2ID',
      emailConfirmedAt: new Date(),
    },
  });
}

async function main() {
  if (flag('listar')) return listar();

  const email = arg('email');
  if (!email) {
    throw new Error('Informe --email, ou use --listar.');
  }

  // O e-mail é único **por conta**, não globalmente: a mesma pessoa pode ter
  // login em duas consultorias. Escolher uma por conta própria seria conceder
  // acesso de plataforma à identidade errada, em silêncio.
  const candidatos = await prisma.user.findMany({
    where: { email: email.trim().toLowerCase() },
    include: { account: true },
  });

  const documento = arg('conta');
  const filtrados = documento
    ? candidatos.filter((u) => u.account.document === documento)
    : candidatos;

  if (filtrados.length > 1) {
    console.error(`"${email}" existe em mais de uma conta. Repita com --conta <documento>:`);
    for (const u of filtrados) console.error(`  ${u.account.document}  ${u.account.name}`);
    process.exitCode = 1;
    return;
  }

  const usuário = filtrados[0] ?? (flag('criar') ? await criarUsuário(email) : null);

  if (!usuário) {
    console.error(
      `"${email}" não existe. Ou ele entra pelo convite da consultoria, ou use ` +
        '--criar --nome "…" --senha "…" para criá-lo na conta da plataforma.',
    );
    process.exitCode = 1;
    return;
  }

  await prisma.platformAdmin.upsert({
    where: { userId: usuário.id },
    create: { userId: usuário.id },
    update: { revokedAt: null, grantedAt: new Date() },
  });

  // `grantedByUserId` fica nulo: não houve um admin concedendo, houve o console.
  // É o que distingue a concessão de origem das feitas pela tela.
  await prisma.auditLog.create({
    data: {
      action: 'platform_admin.granted',
      entityType: 'PlatformAdmin',
      entityId: usuário.id,
      reason: 'Concedido por linha de comando.',
    },
  });

  console.log(`${usuário.email} agora é admin da plataforma.`);
  console.log('Ele entra com o mesmo login de sempre — o Contexto 0 aparece por cima.');
}

main()
  .catch((e: unknown) => {
    console.error(e instanceof Error ? e.message : e);
    process.exitCode = 1;
  })
  .finally(() => prisma.$disconnect());
