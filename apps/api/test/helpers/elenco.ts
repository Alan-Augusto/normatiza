import { Role } from '@prisma/client';

import { PasswordService } from '../../src/auth/password.service';
import { SessionScope } from '../../src/authorization/permission.service';
import { PrismaService } from '../../src/prisma/prisma.service';

/**
 * Monta no banco o elenco de referência da documentação — Josué, Carla,
 * Fernando, Marcos, Antonio, Débora, Rafael e Paulo, na Normatiza que atende BRF
 * e Seara ([01 §2](../../../../docs/produto/01_papeis_e_permissoes.md)).
 *
 * Os testes falam nos nomes das pessoas, não em `user-1`: quando um quebra, a
 * mensagem já diz qual regra de negócio caiu.
 */

export const SENHA_PADRÃO = 'senha-de-teste-123';

export interface Elenco {
  normatiza: { id: string };
  brf: { id: string };
  seara: { id: string };
  josué: Pessoa;
  carla: Pessoa;
  fernando: Pessoa;
  marcos: Pessoa;
  antonio: Pessoa;
  débora: Pessoa;
  rafael: Pessoa;
  paulo: Pessoa;
}

export interface Pessoa {
  id: string;
  email: string;
  senha: string;
}

export async function montarElenco(prisma: PrismaService): Promise<Elenco> {
  const senhas = new PasswordService();
  const passwordHash = await senhas.hash(SENHA_PADRÃO);

  const normatiza = await prisma.account.create({
    data: { name: 'Normatiza', document: '11.111.111/0001-11' },
  });

  const empresa = (corporateName: string, tradeName: string, document: string) =>
    prisma.company.create({
      data: { accountId: normatiza.id, corporateName, tradeName, document },
    });

  const brf = await empresa('BRF S.A.', 'BRF', '22.222.222/0001-22');
  const seara = await empresa('Seara Alimentos Ltda', 'Seara', '33.333.333/0001-33');

  async function pessoa(
    name: string,
    email: string,
    vínculos: { companyId: string; roles: Role[]; executorType?: 'INTERNAL' | 'THIRD_PARTY' }[],
  ): Promise<Pessoa> {
    const user = await prisma.user.create({
      data: {
        accountId: normatiza.id,
        name,
        email,
        status: 'ACTIVE',
        passwordHash,
        passwordAlgo: 'ARGON2ID',
        emailConfirmedAt: new Date(),
      },
    });

    for (const v of vínculos) {
      await prisma.membership.create({
        data: {
          accountId: normatiza.id,
          userId: user.id,
          companyId: v.companyId,
          roles: v.roles,
          executorType: v.executorType,
        },
      });
    }

    return { id: user.id, email, senha: SENHA_PADRÃO };
  }

  const josué = await pessoa('Josué', 'josue@normatiza.com', [
    { companyId: brf.id, roles: ['LEAD_ENGINEER'] },
    { companyId: seara.id, roles: ['LEAD_ENGINEER'] },
  ]);

  await prisma.account.update({
    where: { id: normatiza.id },
    data: { ownerUserId: josué.id },
  });

  return {
    normatiza,
    brf,
    seara,
    josué,
    carla: await pessoa('Carla', 'carla@normatiza.com', [
      { companyId: brf.id, roles: ['CONSULTANT_ENGINEER'] },
      { companyId: seara.id, roles: ['CONSULTANT_ENGINEER'] },
    ]),
    fernando: await pessoa('Fernando', 'fernando@normatiza.com', [
      { companyId: brf.id, roles: ['TECHNICIAN'] },
    ]),
    marcos: await pessoa('Marcos', 'marcos@brf.com', [
      { companyId: brf.id, roles: ['MANAGER'] },
    ]),
    antonio: await pessoa('Antonio', 'antonio@brf.com', [
      { companyId: brf.id, roles: ['CLIENT_ENGINEER'] },
    ]),
    débora: await pessoa('Débora', 'debora@brf.com', [
      { companyId: brf.id, roles: ['DIRECTOR'] },
    ]),
    rafael: await pessoa('Rafael', 'rafael@brf.com', [
      { companyId: brf.id, roles: ['EXECUTOR'], executorType: 'INTERNAL' },
    ]),
    // O terceiro que atende as duas empresas com um login só (D12).
    paulo: await pessoa('Paulo', 'paulo@metalurgicaipe.com', [
      { companyId: brf.id, roles: ['EXECUTOR'], executorType: 'THIRD_PARTY' },
      { companyId: seara.id, roles: ['EXECUTOR'], executorType: 'THIRD_PARTY' },
    ]),
  };
}

/** Monta o escopo de sessão de alguém, como a aplicação monta a cada requisição. */
export async function escopoDe(prisma: PrismaService, userId: string): Promise<SessionScope> {
  const user = await prisma.user.findUniqueOrThrow({
    where: { id: userId },
    include: { memberships: true },
  });

  return {
    userId: user.id,
    accountId: user.accountId,
    memberships: user.memberships as unknown as SessionScope['memberships'],
  };
}

/** Uma segunda consultoria, para provar que nada atravessa contas. */
export async function montarConsultoriaRival(prisma: PrismaService) {
  const conta = await prisma.account.create({
    data: { name: 'Consultoria Rival', document: '99.999.999/0001-99' },
  });

  const empresa = await prisma.company.create({
    data: {
      accountId: conta.id,
      corporateName: 'Cliente da Rival S.A.',
      tradeName: 'Cliente Rival',
      document: '88.888.888/0001-88',
    },
  });

  return { conta, empresa };
}
