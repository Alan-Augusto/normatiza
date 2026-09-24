import { randomBytes } from 'node:crypto';

import {
  BadRequestException,
  ConflictException,
  ForbiddenException,
  NotFoundException,
} from '@nestjs/common';
import type { CompanyDetail, CompanyUpsertRequest, CompanyView } from '@normatiza/shared';

import { Elenco, escopoDe, montarConsultoriaRival, montarElenco } from './helpers/elenco';
import { TestApp, createTestApp } from './helpers/test-app';
import { InvitationsService } from '../src/invitations/invitations.service';
import { CompaniesService } from '../src/companies/companies.service';
import { TeamService } from '../src/team/team.service';

/**
 * O cadastro de empresas ([03 §3.2](../../../docs/produto/03_navegacao_e_telas.md)).
 *
 * Contra o banco de verdade, pelo mesmo motivo da Equipe: o escopo é feito de
 * vínculos, e a unicidade do CNPJ e do grupo são do banco.
 */
describe('Cadastro de empresas (e2e)', () => {
  let ctx: TestApp;
  let companies: CompaniesService;
  let invitations: InvitationsService;
  let team: TeamService;
  let elenco: Elenco;

  beforeAll(async () => {
    ctx = await createTestApp();
    companies = ctx.app.get(CompaniesService);
    invitations = ctx.app.get(InvitationsService);
    team = ctx.app.get(TeamService);
  });

  afterAll(async () => {
    await ctx.close();
  });

  beforeEach(async () => {
    elenco = await montarElenco(ctx.prisma);
  });

  const escopo = (userId: string) => escopoDe(ctx.prisma, userId);

  const PNG = Buffer.concat([
    Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]),
    Buffer.alloc(64),
  ]);

  function empresaNova(over: Partial<CompanyUpsertRequest> = {}): CompanyUpsertRequest {
    return {
      corporateName: 'JBS S.A.',
      tradeName: 'JBS',
      document: '44.444.444/0001-91',
      contact: { name: 'Otávio Lima', role: 'Gerente de SST', email: 'otavio@jbs.com' },
      address: {
        zipCode: '01310-100',
        street: 'Avenida Paulista',
        number: '1000',
        district: 'Bela Vista',
        city: 'São Paulo',
        state: 'SP',
      },
      ...over,
    };
  }

  const nomes = (lista: { tradeName: string }[]) => lista.map((e) => e.tradeName).sort();

  /** Um Gestor convidado e ainda não aceito — com o convite vencendo quando se quiser. */
  async function gestorConvidado(companyId: string, expiresAt: Date) {
    const user = await ctx.prisma.user.create({
      data: {
        accountId: elenco.normatiza.id,
        name: 'Gestor Convidado',
        email: `gestor-${randomBytes(4).toString('hex')}@cliente.com`,
        status: 'INVITED',
      },
    });
    await ctx.prisma.membership.create({
      data: { accountId: elenco.normatiza.id, userId: user.id, companyId, roles: ['MANAGER'] },
    });
    await ctx.prisma.invitation.create({
      data: {
        accountId: elenco.normatiza.id,
        userId: user.id,
        invitedByUserId: elenco.josué.id,
        roles: ['MANAGER'],
        companyIds: [companyId],
        tokenHash: randomBytes(16).toString('hex'),
        expiresAt,
      },
    });
    return user;
  }

  async function vínculosDe(companyId: string) {
    return ctx.prisma.membership.findMany({ where: { companyId, isActive: true } });
  }

  // ───────────────────────────────────────────────────────────────────────────
  // 2.1 — Criar, e em que carteira a empresa nasce
  // ───────────────────────────────────────────────────────────────────────────

  describe('cadastrar', () => {
    it('deve deixar o Engenheiro Responsável cadastrar, e a empresa nascer na carteira dele', async () => {
      const josué = await escopo(elenco.josué.id);

      const jbs = await companies.create(josué, empresaNova());

      expect(jbs.tradeName).toBe('JBS');
      expect(nomes(await companies.list(await escopo(elenco.josué.id)))).toContain('JBS');
    });

    it('deve deixar a Engenheira da Consultoria cadastrar, e a empresa entrar na carteira dela e na do Josué', async () => {
      const carla = await escopo(elenco.carla.id);

      const jbs = await companies.create(carla, empresaNova());

      const vínculos = await vínculosDe(jbs.id);
      expect(vínculos.map((v) => [v.userId, v.roles])).toEqual(
        expect.arrayContaining([
          [elenco.carla.id, ['CONSULTANT_ENGINEER']],
          [elenco.josué.id, ['LEAD_ENGINEER']],
        ]),
      );
    });

    it('não deve pôr ninguém além de quem cadastrou e dos Engenheiros Responsáveis', async () => {
      // O Fernando foi convidado pela Carla, mas a carteira dele é a que ela
      // concedeu — não tudo que ela cria. A regra é por papel, não pela árvore.
      const carla = await escopo(elenco.carla.id);

      const jbs = await companies.create(carla, empresaNova());

      const vínculos = await vínculosDe(jbs.id);
      expect(vínculos.map((v) => v.userId).sort()).toEqual(
        [elenco.carla.id, elenco.josué.id].sort(),
      );
    });

    it('deve nascer em implantação, sem Gestor', async () => {
      const jbs = await companies.create(await escopo(elenco.josué.id), empresaNova());

      expect(jbs.status).toBe('IMPLANTATION');
    });

    it('não deve deixar o Técnico cadastrar', async () => {
      await expect(
        companies.create(await escopo(elenco.fernando.id), empresaNova()),
      ).rejects.toThrow(ForbiddenException);
    });

    it('não deve deixar ninguém do lado cliente cadastrar', async () => {
      for (const pessoa of [elenco.marcos, elenco.antonio, elenco.débora, elenco.rafael]) {
        await expect(companies.create(await escopo(pessoa.id), empresaNova())).rejects.toThrow(
          ForbiddenException,
        );
      }
    });

    it('deve gravar o CNPJ só com dígitos', async () => {
      const jbs = await companies.create(await escopo(elenco.josué.id), empresaNova());

      const linha = await ctx.prisma.company.findUniqueOrThrow({ where: { id: jbs.id } });
      expect(linha.document).toBe('44444444000191');
      expect(linha.zipCode).toBe('01310100');
    });
  });

  // ───────────────────────────────────────────────────────────────────────────
  // 2.2 — Validação que depende do banco
  // ───────────────────────────────────────────────────────────────────────────

  describe('CNPJ', () => {
    it('deve recusar CNPJ com dígito verificador errado', async () => {
      await expect(
        companies.create(await escopo(elenco.josué.id), empresaNova({ document: '44.444.444/0001-92' })),
      ).rejects.toThrow(BadRequestException);
    });

    it('deve recusar CNPJ que já existe na conta, digitado com ou sem máscara', async () => {
      const josué = await escopo(elenco.josué.id);
      await companies.create(josué, empresaNova({ document: '44.444.444/0001-91' }));

      await expect(
        companies.create(josué, empresaNova({ tradeName: 'JBS 2', document: '44444444000191' })),
      ).rejects.toThrow(ConflictException);
    });

    it('deve aceitar o mesmo CNPJ em outra conta — o cliente pode ser atendido por duas consultorias', async () => {
      const rival = await montarConsultoriaRival(ctx.prisma);
      await ctx.prisma.company.update({
        where: { id: rival.empresa.id },
        data: { document: '44444444000191' },
      });

      await expect(
        companies.create(await escopo(elenco.josué.id), empresaNova()),
      ).resolves.toBeDefined();
    });
  });

  // ───────────────────────────────────────────────────────────────────────────
  // 2.3 — A lista é a carteira
  // ───────────────────────────────────────────────────────────────────────────

  describe('a lista', () => {
    it('deve mostrar a cada um só a própria carteira', async () => {
      expect(nomes(await companies.list(await escopo(elenco.josué.id)))).toEqual(['BRF', 'Seara']);
      expect(nomes(await companies.list(await escopo(elenco.fernando.id)))).toEqual(['BRF']);
    });

    it('não deve mostrar à Carla a empresa que o Josué cadastrou', async () => {
      await companies.create(await escopo(elenco.josué.id), empresaNova());

      expect(nomes(await companies.list(await escopo(elenco.carla.id)))).toEqual(['BRF', 'Seara']);
    });

    it('não deve mostrar nada ao lado cliente — a carteira é da consultoria', async () => {
      expect(await companies.list(await escopo(elenco.marcos.id))).toEqual([]);
    });

    it('não deve mostrar empresa de outra conta', async () => {
      await montarConsultoriaRival(ctx.prisma);

      expect(nomes(await companies.list(await escopo(elenco.josué.id)))).toEqual(['BRF', 'Seara']);
    });

    it('deve trazer os números da operação sem inventar: zero onde é zero, nada onde não há medida', async () => {
      const [brf] = await companies.list(await escopo(elenco.fernando.id));

      expect(brf.equipmentsCount).toBe(0);
      expect(brf.openPointsCount).toBe(0);
      expect(brf.adequacyPercent).toBeUndefined();
      expect(brf.lastAnalysisAt).toBeUndefined();
    });

    it('deve nomear o Gestor de cada empresa', async () => {
      const [brf] = await companies.list(await escopo(elenco.fernando.id));

      expect(brf.managers).toEqual([{ id: elenco.marcos.id, name: 'Marcos', pending: false }]);
    });

    it('deve deixar as inativas de fora por padrão, e trazê-las quando pedido', async () => {
      const josué = await escopo(elenco.josué.id);
      await companies.deactivate(josué, elenco.seara.id);

      expect(nomes(await companies.list(josué))).toEqual(['BRF']);
      expect(nomes(await companies.list(josué, { status: 'ALL' }))).toEqual(['BRF', 'Seara']);
      expect(nomes(await companies.list(josué, { status: 'INACTIVE' }))).toEqual(['Seara']);
    });
  });

  // ───────────────────────────────────────────────────────────────────────────
  // 2.4 — Busca
  // ───────────────────────────────────────────────────────────────────────────

  describe('a busca', () => {
    let josué: Awaited<ReturnType<typeof escopo>>;

    beforeEach(async () => {
      josué = await escopo(elenco.josué.id);
      await companies.create(
        josué,
        empresaNova({
          externalCode: 'ERP-7788',
          groupName: 'Grupo Friboi',
          notes: 'Portaria exige EPI completo',
        }),
      );
    });

    // O escopo é montado de novo a cada requisição; o de antes do cadastro não conhece a JBS.
    const busca = async (q: string) => nomes(await companies.list(await escopo(elenco.josué.id), { q }));

    it('deve encontrar sem distinguir acento nem maiúscula', async () => {
      expect(await busca('sao paulo')).toEqual(['JBS']);
      expect(await busca('OTÁVIO')).toEqual(['JBS']);
    });

    it('deve encontrar pelo CNPJ com ou sem máscara, e por trecho dele', async () => {
      expect(await busca('44.444.444/0001-91')).toEqual(['JBS']);
      expect(await busca('44444444')).toEqual(['JBS']);
    });

    it('deve encontrar pelo grupo, pelo código interno e pelo nome do Gestor', async () => {
      expect(await busca('friboi')).toEqual(['JBS']);
      expect(await busca('erp-7788')).toEqual(['JBS']);
      expect(await busca('marcos')).toEqual(['BRF']);
    });

    it('não deve procurar nas observações — texto livre dá resultado que ninguém entende', async () => {
      expect(await busca('portaria')).toEqual([]);
    });
  });

  // ───────────────────────────────────────────────────────────────────────────
  // 2.5 — Status derivado
  // ───────────────────────────────────────────────────────────────────────────

  describe('o status', () => {
    const statusDe = async (companyId: string) => {
      const lista = await companies.list(await escopo(elenco.josué.id), { status: 'ALL' });
      return lista.find((e) => e.id === companyId)?.status;
    };

    it('deve estar ativa quando um Gestor já aceitou o convite', async () => {
      expect(await statusDe(elenco.brf.id)).toBe('ACTIVE');
    });

    it('deve estar em implantação quando não há Gestor', async () => {
      expect(await statusDe(elenco.seara.id)).toBe('IMPLANTATION');
    });

    it('deve aguardar o Gestor enquanto o convite dele está aberto', async () => {
      await gestorConvidado(elenco.seara.id, new Date(Date.now() + 86_400_000));

      expect(await statusDe(elenco.seara.id)).toBe('AWAITING_MANAGER');
    });

    it('deve voltar a implantação quando o convite do Gestor vence — sem ninguém fazer nada', async () => {
      await gestorConvidado(elenco.seara.id, new Date(Date.now() - 1000));

      expect(await statusDe(elenco.seara.id)).toBe('IMPLANTATION');
    });

    it('deve chegar à sessão com o mesmo status', async () => {
      // Sidebar e lista não podem discordar sobre a mesma empresa.
      await gestorConvidado(elenco.seara.id, new Date(Date.now() + 86_400_000));

      const [pessoa] = await team.listAccountTeam(await escopo(elenco.josué.id), {
        companyId: elenco.seara.id,
      });
      const daSeara = pessoa.memberships.find((v) => v.companyId === elenco.seara.id);
      expect(daSeara?.company.status).toBe('AWAITING_MANAGER');
    });
  });

  // ───────────────────────────────────────────────────────────────────────────
  // 2.6 — Duas projeções de detalhe
  // ───────────────────────────────────────────────────────────────────────────

  describe('o detalhe', () => {
    beforeEach(async () => {
      await ctx.prisma.company.update({
        where: { id: elenco.brf.id },
        data: { externalCode: 'CLI-0001', notes: 'Visitas às terças.' },
      });
    });

    it('deve dar à consultoria a visão completa, com o que ela anota sobre o cliente', async () => {
      const brf = (await companies.get(await escopo(elenco.carla.id), elenco.brf.id)) as CompanyDetail;

      expect(brf.view).toBe('CONSULTANCY');
      expect(brf.externalCode).toBe('CLI-0001');
      expect(brf.notes).toBe('Visitas às terças.');
      expect(brf.actions.edit).toBe(true);
    });

    it('deve dar ao Marcos a própria empresa, sem as anotações da consultoria', async () => {
      const brf: CompanyView = await companies.get(await escopo(elenco.marcos.id), elenco.brf.id);

      expect(brf.view).toBe('CLIENT');
      expect(brf).not.toHaveProperty('externalCode');
      expect(brf).not.toHaveProperty('notes');
      expect(brf).not.toHaveProperty('group');
      expect(brf).not.toHaveProperty('managers');
      expect(brf).not.toHaveProperty('actions');
    });

    it('deve nomear para o cliente quem presta o serviço e quem assina — e não o Técnico', async () => {
      const brf = await companies.get(await escopo(elenco.débora.id), elenco.brf.id);

      expect(brf.accountName).toBe('Normatiza');
      expect(brf.technicalResponsibles.map((r) => r.name).sort()).toEqual(['Carla', 'Josué']);
    });

    it('deve responder que não existe quando a empresa está fora do escopo', async () => {
      await expect(
        companies.get(await escopo(elenco.marcos.id), elenco.seara.id),
      ).rejects.toThrow(NotFoundException);
      await expect(
        companies.get(await escopo(elenco.fernando.id), elenco.seara.id),
      ).rejects.toThrow(NotFoundException);
    });

    it('não deve abrir a empresa ao Executor — o escopo dele são as tarefas', async () => {
      await expect(
        companies.get(await escopo(elenco.rafael.id), elenco.brf.id),
      ).rejects.toThrow(NotFoundException);
    });
  });

  // ───────────────────────────────────────────────────────────────────────────
  // 2.7 — Editar, desativar, reativar
  // ───────────────────────────────────────────────────────────────────────────

  describe('editar', () => {
    it('deve deixar a consultoria editar o que está na carteira dela', async () => {
      const carla = await escopo(elenco.carla.id);

      const brf = await companies.update(
        carla,
        elenco.brf.id,
        empresaNova({ tradeName: 'BRF Concórdia', document: '22.222.222/0001-91' }),
      );

      expect(brf.tradeName).toBe('BRF Concórdia');
    });

    it('não deve deixar a Carla editar empresa fora da carteira — nem saber que ela existe', async () => {
      const jbs = await companies.create(await escopo(elenco.josué.id), empresaNova());

      await expect(
        companies.update(await escopo(elenco.carla.id), jbs.id, empresaNova()),
      ).rejects.toThrow(NotFoundException);
    });

    it('não deve deixar o Técnico nem o Gestor editar', async () => {
      for (const pessoa of [elenco.fernando, elenco.marcos]) {
        await expect(
          companies.update(await escopo(pessoa.id), elenco.brf.id, empresaNova()),
        ).rejects.toThrow(ForbiddenException);
      }
    });
  });

  describe('desativar e reativar', () => {
    it('deve deixar a empresa inativa e registrar quem desativou', async () => {
      await companies.deactivate(await escopo(elenco.carla.id), elenco.brf.id);

      const linha = await ctx.prisma.company.findUniqueOrThrow({ where: { id: elenco.brf.id } });
      expect(linha.deactivatedAt).not.toBeNull();
      expect(linha.deactivatedByUserId).toBe(elenco.carla.id);
    });

    it('não deve derrubar o acesso de ninguém — inativa é leitura, não despejo', async () => {
      await companies.deactivate(await escopo(elenco.josué.id), elenco.brf.id);

      const brf = await companies.get(await escopo(elenco.marcos.id), elenco.brf.id);
      expect(brf.status).toBe('INACTIVE');
    });

    it('deve voltar a ativa ao reativar, quando ainda há Gestor', async () => {
      const josué = await escopo(elenco.josué.id);
      await companies.deactivate(josué, elenco.brf.id);

      await companies.reactivate(josué, elenco.brf.id);

      expect((await companies.get(josué, elenco.brf.id)).status).toBe('ACTIVE');
    });

    it('deve voltar a implantação ao reativar, quando não há Gestor', async () => {
      const josué = await escopo(elenco.josué.id);
      await companies.deactivate(josué, elenco.seara.id);

      await companies.reactivate(josué, elenco.seara.id);

      expect((await companies.get(josué, elenco.seara.id)).status).toBe('IMPLANTATION');
    });

    it('não deve deixar o Técnico nem o lado cliente desativar', async () => {
      for (const pessoa of [elenco.fernando, elenco.marcos]) {
        await expect(
          companies.deactivate(await escopo(pessoa.id), elenco.brf.id),
        ).rejects.toThrow(ForbiddenException);
      }
    });
  });

  // ───────────────────────────────────────────────────────────────────────────
  // 2.8 — Modo leitura
  // ───────────────────────────────────────────────────────────────────────────

  describe('empresa inativa é modo leitura', () => {
    beforeEach(async () => {
      await companies.deactivate(await escopo(elenco.josué.id), elenco.brf.id);
    });

    it('deve recusar editar a própria empresa', async () => {
      await expect(
        companies.update(await escopo(elenco.josué.id), elenco.brf.id, empresaNova({ document: '22.222.222/0001-91' })),
      ).rejects.toThrow(ForbiddenException);
    });

    it('deve recusar convite para dentro dela', async () => {
      await expect(
        invitations.create(await escopo(elenco.marcos.id), {
          name: 'Novo Executor',
          email: 'novo@brf.com',
          roles: ['EXECUTOR'],
          companyIds: [elenco.brf.id],
          executorType: 'INTERNAL',
        }),
      ).rejects.toThrow(ForbiddenException);
    });

    it('deve recusar troca de papel e remoção dentro dela', async () => {
      const marcos = await escopo(elenco.marcos.id);
      const vínculoDoAntonio = await ctx.prisma.membership.findFirstOrThrow({
        where: { userId: elenco.antonio.id, companyId: elenco.brf.id },
      });

      await expect(
        team.updateMembershipRoles(marcos, vínculoDoAntonio.id, { roles: ['DIRECTOR'] }),
      ).rejects.toThrow(ForbiddenException);
      await expect(team.removeFromCompany(marcos, vínculoDoAntonio.id)).rejects.toThrow(
        ForbiddenException,
      );
    });

    it('deve continuar deixando ler', async () => {
      await expect(
        team.listCompanyMembers(await escopo(elenco.débora.id), elenco.brf.id),
      ).resolves.toBeDefined();
    });

    it('deve oferecer reativar, e não editar nem desativar', async () => {
      const brf = (await companies.get(await escopo(elenco.josué.id), elenco.brf.id)) as CompanyDetail;

      expect(brf.actions).toEqual({ edit: false, deactivate: false, reactivate: true });
    });
  });

  // ───────────────────────────────────────────────────────────────────────────
  // 2.9 — Grupos
  // ───────────────────────────────────────────────────────────────────────────

  describe('grupo empresarial', () => {
    it('deve criar o grupo no próprio cadastro, pelo nome', async () => {
      const jbs = await companies.create(
        await escopo(elenco.josué.id),
        empresaNova({ groupName: 'Grupo Friboi' }),
      );

      expect(jbs.group?.name).toBe('Grupo Friboi');
    });

    it('deve reaproveitar o grupo que já existe, sem distinguir acento nem maiúscula', async () => {
      const josué = await escopo(elenco.josué.id);
      const a = await companies.create(josué, empresaNova({ groupName: 'Grupo Friboi' }));
      const b = await companies.create(
        josué,
        empresaNova({ tradeName: 'Friboi', document: '55555555000191', groupName: '  grupo FRIBÓI ' }),
      );

      expect(b.group?.id).toBe(a.group?.id);
    });

    it('deve oferecer à Carla só os grupos com empresa na carteira dela', async () => {
      await companies.create(await escopo(elenco.josué.id), empresaNova({ groupName: 'Grupo Friboi' }));
      await companies.update(
        await escopo(elenco.josué.id),
        elenco.brf.id,
        empresaNova({ tradeName: 'BRF', document: '22222222000191', groupName: 'Grupo BRF' }),
      );

      const grupos = await companies.listGroups(await escopo(elenco.carla.id));

      expect(grupos.map((g) => g.name)).toEqual(['Grupo BRF']);
    });

    it('deve reaproveitar em silêncio um grupo que está fora da carteira de quem cadastra', async () => {
      // A Carla não vê o "Grupo Friboi" na lista. Se digitar o mesmo nome, o
      // grupo é o mesmo — sem duplicar, e sem a tela contar a ela que existia.
      const daJbs = await companies.create(
        await escopo(elenco.josué.id),
        empresaNova({ groupName: 'Grupo Friboi' }),
      );

      const daCarla = await companies.create(
        await escopo(elenco.carla.id),
        empresaNova({ tradeName: 'Friboi', document: '55555555000191', groupName: 'Grupo Friboi' }),
      );

      expect(daCarla.group?.id).toBe(daJbs.group?.id);
      expect(await ctx.prisma.companyGroup.count()).toBe(1);
    });

    it('deve tirar a empresa do grupo quando o nome vem vazio', async () => {
      const jbs = await companies.create(await escopo(elenco.josué.id), empresaNova({ groupName: 'Grupo Friboi' }));

      const semGrupo = await companies.update(
        await escopo(elenco.josué.id),
        jbs.id,
        empresaNova({ groupName: null }),
      );

      expect(semGrupo.group).toBeUndefined();
    });
  });

  // ───────────────────────────────────────────────────────────────────────────
  // 2.10 — Logo
  // ───────────────────────────────────────────────────────────────────────────

  describe('logo', () => {
    it('deve aceitar o logo enviado pela consultoria e devolver uma URL de leitura', async () => {
      const { logoUrl } = await companies.setLogo(await escopo(elenco.carla.id), elenco.brf.id, PNG);

      expect(logoUrl).toBeTruthy();
      const brf = await companies.get(await escopo(elenco.marcos.id), elenco.brf.id);
      expect(brf.logoUrl).toBeTruthy();
    });

    it('deve trazer o logo também na lista, e nada onde não há logo', async () => {
      const josué = await escopo(elenco.josué.id);
      await companies.setLogo(josué, elenco.brf.id, PNG);

      const lista = await companies.list(josué, { status: 'ALL' });
      expect(lista.find((e) => e.id === elenco.brf.id)?.logoUrl).toBeTruthy();
      expect(lista.find((e) => e.id !== elenco.brf.id)?.logoUrl).toBeUndefined();
    });

    it('deve guardar o arquivo como da conta e da empresa, visível ao cliente', async () => {
      await companies.setLogo(await escopo(elenco.josué.id), elenco.brf.id, PNG);

      const arquivo = await ctx.prisma.fileAsset.findFirstOrThrow({ where: { companyId: elenco.brf.id } });
      expect(arquivo.accountId).toBe(elenco.normatiza.id);
      expect(arquivo.visibility).toBe('CLIENT_VISIBLE');
    });

    it('não deve aceitar logo do lado cliente', async () => {
      await expect(
        companies.setLogo(await escopo(elenco.marcos.id), elenco.brf.id, PNG),
      ).rejects.toThrow(ForbiddenException);
    });

    it('deve preservar o arquivo antigo ao trocar ou remover o logo', async () => {
      // Laudo emitido continua apontando para o logo da época.
      const josué = await escopo(elenco.josué.id);
      await companies.setLogo(josué, elenco.brf.id, PNG);
      await companies.setLogo(josué, elenco.brf.id, PNG);
      await companies.removeLogo(josué, elenco.brf.id);

      expect(await ctx.prisma.fileAsset.count({ where: { companyId: elenco.brf.id } })).toBe(2);
      const brf = await companies.get(josué, elenco.brf.id);
      expect(brf.logoUrl).toBeUndefined();
    });
  });

  // ───────────────────────────────────────────────────────────────────────────
  // 2.11 — `actions` concorda com a mutação
  // ───────────────────────────────────────────────────────────────────────────

  describe('o que a lista oferece é o que o servidor aceita', () => {
    it('deve recusar toda ação que veio falsa, e aceitar toda que veio verdadeira', async () => {
      const pessoas = [elenco.josué, elenco.carla, elenco.fernando];

      for (const pessoa of pessoas) {
        const eu = await escopo(pessoa.id);
        for (const linha of await companies.list(eu, { status: 'ALL' })) {
          const editar = companies.update(eu, linha.id, empresaNova({ document: linha.document, tradeName: linha.tradeName }));
          if (linha.actions.edit) await expect(editar).resolves.toBeDefined();
          else await expect(editar).rejects.toThrow();

          const desativar = companies.deactivate(eu, linha.id);
          if (linha.actions.deactivate) {
            await expect(desativar).resolves.toBeUndefined();
            await companies.reactivate(await escopo(elenco.josué.id), linha.id);
          } else {
            await expect(desativar).rejects.toThrow();
          }
        }
      }
    });
  });
});
