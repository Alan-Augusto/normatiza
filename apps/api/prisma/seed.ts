import { PrismaClient, type ExecutorType, type Role } from '@prisma/client';
import * as argon2 from 'argon2';
import { config as loadEnv } from 'dotenv';

loadEnv();

/**
 * Seed de desenvolvimento: **o elenco da documentação**, inteiro.
 *
 * São as mesmas oito pessoas do §2 de docs/produto/01_papeis_e_permissoes.md,
 * com os mesmos papéis e os mesmos escopos. O objetivo é poder entrar como
 * cada uma e conferir o que ela vê — que é metade das regras deste sistema.
 *
 * Duas empresas de propósito. Com uma só, o Josué e a Carla teriam carteira de
 * um item, e três coisas ficariam impossíveis de testar: a coluna "Empresas"
 * (que some quando não varia), o teto de escopo do convite, e a fronteira do
 * D1 — o Marcos não pode descobrir que a Normatiza também atende a Seara.
 */

const prisma = new PrismaClient();

/**
 * A senha de todo o elenco. O padrão é genérico de propósito: a senha que se
 * usa de fato vem de `SEED_PASSWORD` no `.env`, que está fora do git. Uma senha
 * pessoal commitada continua no histórico depois de trocada.
 */
const SENHA = process.env.SEED_PASSWORD ?? 'normatiza-dev-123';

/**
 * Apagar usuário é opt-in explícito. Sem isto, `pnpm prisma:seed` é sempre
 * seguro de rodar: ele completa o que falta e não derruba nada.
 */
const RESETAR = process.env.SEED_RESET === '1';

const BRF = '22.222.222/0001-22';
const SEARA = '33.333.333/0001-33';

/** Quem é quem — a ordem é a da árvore de convites, e ela importa. */
type Pessoa = {
  chave: string;
  nome: string;
  email: string;
  papeis: Role[];
  /** Por CNPJ, e não por id: o id só existe depois de a empresa ser criada. */
  empresas: string[];
  convidadoPor?: string;
  cargo?: string;
  registro?: { tipo: 'CREA' | 'CFT'; numero: string };
  tipoDeExecutor?: ExecutorType;
};

const ELENCO: Pessoa[] = [
  {
    chave: 'josue',
    nome: 'Josué',
    email: 'josue@normatiza.com',
    papeis: ['LEAD_ENGINEER'],
    empresas: [BRF, SEARA],
    cargo: 'Engenheiro Responsável',
    registro: { tipo: 'CREA', numero: 'CREA-SP 000000' },
  },
  {
    chave: 'carla',
    nome: 'Carla',
    email: 'carla@email.com',
    papeis: ['CONSULTANT_ENGINEER'],
    empresas: [BRF, SEARA],
    convidadoPor: 'josue',
    cargo: 'Engenheira de Segurança',
    registro: { tipo: 'CREA', numero: 'CREA-SP 111111' },
  },
  {
    chave: 'fernando',
    nome: 'Fernando',
    email: 'fernando@email.com',
    papeis: ['TECHNICIAN'],
    // Só a BRF: é o caso que faz a coluna "Empresas" sumir para ele.
    empresas: [BRF],
    convidadoPor: 'carla',
    cargo: 'Técnico de Segurança',
    registro: { tipo: 'CFT', numero: 'CFT-SP 222222' },
  },
  {
    chave: 'marcos',
    nome: 'Marcos',
    email: 'marcos@email.com',
    papeis: ['MANAGER'],
    empresas: [BRF],
    convidadoPor: 'josue',
    cargo: 'Coordenador de SST',
  },
  {
    chave: 'antonio',
    nome: 'Antonio',
    email: 'antonio@email.com',
    papeis: ['CLIENT_ENGINEER'],
    empresas: [BRF],
    convidadoPor: 'marcos',
    cargo: 'Engenheiro de Segurança da BRF',
    registro: { tipo: 'CREA', numero: 'CREA-SP 333333' },
  },
  {
    chave: 'debora',
    nome: 'Débora',
    email: 'debora@email.com',
    papeis: ['DIRECTOR'],
    empresas: [BRF],
    convidadoPor: 'marcos',
    cargo: 'Diretora Industrial',
  },
  {
    chave: 'rafael',
    nome: 'Rafael',
    email: 'rafael@email.com',
    papeis: ['EXECUTOR'],
    empresas: [BRF],
    convidadoPor: 'antonio',
    cargo: 'Eletricista de Manutenção',
    tipoDeExecutor: 'INTERNAL',
  },
  {
    chave: 'paulo',
    nome: 'Paulo',
    email: 'paulo@email.com',
    papeis: ['EXECUTOR'],
    empresas: [BRF],
    convidadoPor: 'antonio',
    cargo: 'Metalúrgica Ipê',
    tipoDeExecutor: 'THIRD_PARTY',
  },
];

/**
 * Apaga **todos** os usuários e o que pende deles.
 *
 * A ordem não é estética: cada passo tira uma chave estrangeira do caminho do
 * seguinte. As duas atualizações no meio existem porque `Account.ownerUserId` e
 * a árvore de convites apontam para usuário — e não se apaga uma linha de que
 * outra ainda depende, mesmo que ambas estejam de saída.
 */
async function limpar(): Promise<void> {
  await prisma.refreshToken.deleteMany();
  await prisma.passwordResetToken.deleteMany();
  await prisma.invitation.deleteMany();
  await prisma.membership.deleteMany();
  await prisma.platformAdmin.deleteMany();

  // A trilha aponta para usuário por id solto, sem chave estrangeira: ela não
  // impediria o apagamento, mas sobreviveria apontando para quem não existe.
  await prisma.auditLog.deleteMany();

  await prisma.account.updateMany({ data: { ownerUserId: null } });
  await prisma.user.updateMany({ data: { invitedByUserId: null, succeededByUserId: null } });

  const { count } = await prisma.user.deleteMany();
  console.log(`  ${count} usuário(s) apagado(s).`);
}

async function main() {
  if (process.env.NODE_ENV === 'production') {
    throw new Error('O seed é de desenvolvimento e não roda em produção.');
  }

  if (RESETAR) {
    console.log('Limpando…');
    await limpar();
  }

  const passwordHash = await argon2.hash(SENHA, { type: argon2.argon2id });

  const conta = await prisma.account.upsert({
    where: { document: '11.111.111/0001-11' },
    update: {},
    create: { name: 'Normatiza', document: '11.111.111/0001-11' },
  });

  const empresas = new Map<string, string>();
  for (const [document, corporateName, tradeName] of [
    [BRF, 'BRF S.A.', 'BRF'],
    [SEARA, 'Seara Alimentos Ltda.', 'Seara'],
  ] as const) {
    const empresa = await prisma.company.upsert({
      where: { accountId_document: { accountId: conta.id, document } },
      update: {},
      create: { accountId: conta.id, corporateName, tradeName, document },
    });
    empresas.set(document, empresa.id);
  }

  // Duas passadas: a árvore de convites referencia gente que ainda não existe
  // na primeira. Criar todo mundo e só depois ligar as arestas evita ordenar o
  // elenco por dependência — ordem que se quebraria no primeiro nome novo.
  const ids = new Map<string, string>();

  for (const pessoa of ELENCO) {
    const usuario = await prisma.user.upsert({
      where: { accountId_email: { accountId: conta.id, email: pessoa.email } },
      update: { passwordHash, passwordAlgo: 'ARGON2ID', status: 'ACTIVE', disabledAt: null },
      create: {
        accountId: conta.id,
        name: pessoa.nome,
        email: pessoa.email,
        status: 'ACTIVE',
        passwordHash,
        passwordAlgo: 'ARGON2ID',
        emailConfirmedAt: new Date(),
        jobTitle: pessoa.cargo,
        registryType: pessoa.registro?.tipo,
        registryNumber: pessoa.registro?.numero,
      },
    });
    ids.set(pessoa.chave, usuario.id);
  }

  for (const pessoa of ELENCO) {
    if (!pessoa.convidadoPor) continue;
    await prisma.user.update({
      where: { id: ids.get(pessoa.chave) },
      data: { invitedByUserId: ids.get(pessoa.convidadoPor) },
    });
  }

  await prisma.account.update({
    where: { id: conta.id },
    data: { ownerUserId: ids.get('josue') },
  });

  for (const pessoa of ELENCO) {
    for (const documento of pessoa.empresas) {
      const userId = ids.get(pessoa.chave)!;
      const companyId = empresas.get(documento)!;

      await prisma.membership.upsert({
        where: { userId_companyId: { userId, companyId } },
        update: { roles: pessoa.papeis, executorType: pessoa.tipoDeExecutor, isActive: true },
        create: {
          accountId: conta.id,
          userId,
          companyId,
          roles: pessoa.papeis,
          executorType: pessoa.tipoDeExecutor,
        },
      });
    }
  }

  // O Josué é dono da consultoria **e** dono da plataforma — um login só, com o
  // Contexto 0 sobreposto. É o caso real do produto, e é o que o seed reproduz.
  await prisma.platformAdmin.upsert({
    where: { userId: ids.get('josue')! },
    update: { revokedAt: null },
    create: { userId: ids.get('josue')! },
  });

  console.log('\nSeed pronto — Normatiza atendendo BRF e Seara.\n');
  console.log('  CONSULTORIA');
  console.log('    josue@normatiza.com   Eng. Responsável · BRF + Seara · titular · admin da plataforma');
  console.log('    carla@email.com       Eng. da Consultoria · BRF + Seara');
  console.log('    fernando@email.com    Técnico · só BRF');
  console.log('  CLIENTE — BRF');
  console.log('    marcos@email.com      Gestor · aprova orçamento e convida');
  console.log('    antonio@email.com     Eng. do Cliente · só convida Executor');
  console.log('    debora@email.com      Diretora · leitura pura, não convida ninguém');
  console.log('    rafael@email.com      Executor interno');
  console.log('    paulo@email.com       Executor terceiro');
  console.log(`\n  Senha de todos:       ${SENHA}\n`);
}

main()
  .catch((e) => {
    console.error(e);
    process.exitCode = 1;
  })
  .finally(() => prisma.$disconnect());
