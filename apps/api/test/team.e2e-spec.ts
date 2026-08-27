import {
  BadRequestException,
  ForbiddenException,
  NotFoundException,
  UnauthorizedException,
} from '@nestjs/common';

import { Elenco, escopoDe, montarConsultoriaRival, montarElenco } from './helpers/elenco';
import { TestApp, createTestApp } from './helpers/test-app';
import { PasswordService } from '../src/auth/password.service';
import { TokenService } from '../src/auth/token.service';
import { ProfileService } from '../src/team/profile.service';
import { TeamService } from '../src/team/team.service';
import { UserLifecycleService } from '../src/team/user-lifecycle.service';

/**
 * O ciclo de vida da pessoa depois que ela entra: ver, mudar de papel e
 * desligar ([01 §5](../../../docs/produto/01_papeis_e_permissoes.md)).
 *
 * Contra o banco de verdade porque duas das regras aqui **são** do banco: o
 * índice parcial que garante papel de escopo-empresa em um vínculo só, e as
 * chaves compostas que impedem qualquer coisa de atravessar contas. Um Prisma
 * falso concordaria com o que eu escrevesse — inclusive com o que estivesse
 * errado.
 */
describe('Gestão de equipe (e2e)', () => {
  let ctx: TestApp;
  let team: TeamService;
  let lifecycle: UserLifecycleService;
  let profile: ProfileService;
  let tokens: TokenService;
  let elenco: Elenco;

  beforeAll(async () => {
    ctx = await createTestApp();
    team = ctx.app.get(TeamService);
    lifecycle = ctx.app.get(UserLifecycleService);
    profile = ctx.app.get(ProfileService);
    tokens = ctx.app.get(TokenService);
  });

  afterAll(async () => {
    await ctx.close();
  });

  beforeEach(async () => {
    elenco = await montarElenco(ctx.prisma);
  });

  const nomes = (lista: { name: string }[]) => lista.map((m) => m.name).sort();

  /** Alguém que existe só na Seara — para provar o recorte por carteira. */
  async function gestorDaSeara() {
    const user = await ctx.prisma.user.create({
      data: {
        accountId: elenco.normatiza.id,
        name: 'Gestor da Seara',
        email: 'gestor@seara.com',
        status: 'ACTIVE',
      },
    });
    await ctx.prisma.membership.create({
      data: {
        accountId: elenco.normatiza.id,
        userId: user.id,
        companyId: elenco.seara.id,
        roles: ['MANAGER'],
      },
    });
    return user;
  }

  async function vínculoDe(userId: string, companyId: string) {
    return ctx.prisma.membership.findFirstOrThrow({ where: { userId, companyId } });
  }

  // ───────────────────────────────────────────────────────────────────────────
  // 2.1 — Equipe da conta
  // ───────────────────────────────────────────────────────────────────────────

  describe('a equipe da conta', () => {
    it('deve mostrar ao Engenheiro Responsável todo mundo da consultoria', async () => {
      const josué = await escopoDe(ctx.prisma, elenco.josué.id);

      const equipe = await team.listAccountTeam(josué);

      expect(nomes(equipe)).toEqual(
        ['Antonio', 'Carla', 'Débora', 'Fernando', 'Josué', 'Marcos', 'Paulo', 'Rafael'].sort(),
      );
    });

    it('não deve mostrar ninguém de outra consultoria', async () => {
      // O limite absoluto do sistema. Nada atravessa contas, em nenhuma hipótese.
      const rival = await montarConsultoriaRival(ctx.prisma);
      await ctx.prisma.user.create({
        data: {
          accountId: rival.conta.id,
          name: 'Gente da Rival',
          email: 'alguem@rival.com',
          status: 'ACTIVE',
        },
      });

      const josué = await escopoDe(ctx.prisma, elenco.josué.id);
      const equipe = await team.listAccountTeam(josué);

      expect(nomes(equipe)).not.toContain('Gente da Rival');
    });

    it('deve recortar pela carteira de quem pergunta', async () => {
      // O Fernando é Técnico só da BRF. A Seara não é escopo dele, e quem
      // trabalha só lá não deve aparecer na lista que ele enxerga.
      await gestorDaSeara();
      const fernando = await escopoDe(ctx.prisma, elenco.fernando.id);

      const equipe = await team.listAccountTeam(fernando);

      expect(nomes(equipe)).not.toContain('Gestor da Seara');
      expect(nomes(equipe)).toContain('Marcos');
    });

    it('deve trazer quem convidou, para a árvore ficar visível', async () => {
      const josué = await escopoDe(ctx.prisma, elenco.josué.id);
      await ctx.prisma.user.update({
        where: { id: elenco.rafael.id },
        data: { invitedByUserId: elenco.marcos.id },
      });

      const equipe = await team.listAccountTeam(josué);
      const rafael = equipe.find((m) => m.name === 'Rafael');

      expect(rafael?.invitedBy?.name).toBe('Marcos');
    });

    it('deve marcar quem titulariza a conta', async () => {
      const josué = await escopoDe(ctx.prisma, elenco.josué.id);

      const equipe = await team.listAccountTeam(josué);

      expect(equipe.find((m) => m.name === 'Josué')?.isAccountOwner).toBe(true);
      expect(equipe.find((m) => m.name === 'Marcos')?.isAccountOwner).toBe(false);
    });

    it('deve filtrar por empresa e por papel', async () => {
      const josué = await escopoDe(ctx.prisma, elenco.josué.id);

      const daSeara = await team.listAccountTeam(josué, { companyId: elenco.seara.id });
      expect(nomes(daSeara)).toEqual(['Carla', 'Josué', 'Paulo'].sort());

      const executores = await team.listAccountTeam(josué, { role: 'EXECUTOR' });
      expect(nomes(executores)).toEqual(['Paulo', 'Rafael'].sort());
    });
  });

  // ───────────────────────────────────────────────────────────────────────────
  // 2.2 — Equipe da empresa
  // ───────────────────────────────────────────────────────────────────────────

  describe('a equipe de uma empresa', () => {
    it('deve mostrar ao Gestor quem tem acesso à empresa dele', async () => {
      const marcos = await escopoDe(ctx.prisma, elenco.marcos.id);

      const equipe = await team.listCompanyMembers(marcos, elenco.brf.id);

      expect(nomes(equipe)).toEqual(
        ['Antonio', 'Carla', 'Débora', 'Fernando', 'Josué', 'Marcos', 'Paulo', 'Rafael'].sort(),
      );
    });

    it('não deve deixar o Gestor da BRF listar a Seara', async () => {
      // "Não existe", e não "não pode": o Marcos não sabe que a Seara existe, e
      // um 403 lhe contaria que existe algo ali para ser proibido.
      const marcos = await escopoDe(ctx.prisma, elenco.marcos.id);

      await expect(team.listCompanyMembers(marcos, elenco.seara.id)).rejects.toBeInstanceOf(
        NotFoundException,
      );
    });

    it('não deve revelar a existência de outra empresa (D15)', async () => {
      // O vazamento que esta projeção existe para impedir: o Marcos descobrir,
      // por um campo a mais, que a Normatiza também atende a Seara.
      const marcos = await escopoDe(ctx.prisma, elenco.marcos.id);

      const equipe = await team.listCompanyMembers(marcos, elenco.brf.id);

      expect(JSON.stringify(equipe)).not.toContain(elenco.seara.id);
      expect(JSON.stringify(equipe)).not.toContain(elenco.normatiza.id);
    });

    it('deve dizer de onde cada pessoa vem', async () => {
      const marcos = await escopoDe(ctx.prisma, elenco.marcos.id);

      const equipe = await team.listCompanyMembers(marcos, elenco.brf.id);
      const origem = (nome: string) => equipe.find((m) => m.name === nome)?.origin;

      expect(origem('Carla')).toBe('CONSULTANCY');
      expect(origem('Marcos')).toBe('CLIENT');
      expect(origem('Rafael')).toBe('CLIENT');
      expect(origem('Paulo')).toBe('EXTERNAL');
    });

    it('deve listar o executor de várias empresas em cada uma delas', async () => {
      const josué = await escopoDe(ctx.prisma, elenco.josué.id);

      const brf = await team.listCompanyMembers(josué, elenco.brf.id);
      const seara = await team.listCompanyMembers(josué, elenco.seara.id);

      expect(nomes(brf)).toContain('Paulo');
      expect(nomes(seara)).toContain('Paulo');
    });

    it('nunca deve oferecer o desligamento da conta nesta tela (D8)', async () => {
      const josué = await escopoDe(ctx.prisma, elenco.josué.id);

      const equipe = await team.listCompanyMembers(josué, elenco.brf.id);

      expect(equipe.every((m) => m.actions.disableFromAccount === false)).toBe(true);
    });
  });

  // ───────────────────────────────────────────────────────────────────────────
  // 2.3 — Trocar papel
  // ───────────────────────────────────────────────────────────────────────────

  describe('trocar o papel de alguém', () => {
    it('deve acumular papéis no mesmo vínculo, não abrir um segundo', async () => {
      // A empresa pequena, onde uma pessoa orça como Engenheiro do Cliente e
      // aprova como Gestor ([01 §5]).
      const josué = await escopoDe(ctx.prisma, elenco.josué.id);
      const vínculo = await vínculoDe(elenco.antonio.id, elenco.brf.id);

      await team.updateMembershipRoles(josué, vínculo.id, {
        roles: ['CLIENT_ENGINEER', 'MANAGER'],
      });

      const vínculos = await ctx.prisma.membership.findMany({
        where: { userId: elenco.antonio.id, isActive: true },
      });

      expect(vínculos).toHaveLength(1);
      expect(vínculos[0].roles.sort()).toEqual(['CLIENT_ENGINEER', 'MANAGER']);
    });

    it('deve recusar o papel acima da alçada de quem promove (D3)', async () => {
      // A Carla convida Técnico e mais nada.
      const carla = await escopoDe(ctx.prisma, elenco.carla.id);
      const vínculo = await vínculoDe(elenco.fernando.id, elenco.brf.id);

      await expect(
        team.updateMembershipRoles(carla, vínculo.id, { roles: ['MANAGER'] }),
      ).rejects.toBeInstanceOf(ForbiddenException);
    });

    it('deve explicar o conflito de papel de escopo-empresa em linguagem de negócio', async () => {
      // Gestor, Engenheiro do Cliente e Diretor valem em **uma** empresa só, e
      // quem garante isso é um índice parcial do Postgres. Se a regra vazar como
      // erro de constraint, o usuário lê uma mensagem que não é para ele.
      const josué = await escopoDe(ctx.prisma, elenco.josué.id);

      const naBrf = await vínculoDe(elenco.paulo.id, elenco.brf.id);
      await team.updateMembershipRoles(josué, naBrf.id, { roles: ['MANAGER'] });

      const naSeara = await vínculoDe(elenco.paulo.id, elenco.seara.id);
      const recusa = team.updateMembershipRoles(josué, naSeara.id, { roles: ['DIRECTOR'] });

      await expect(recusa).rejects.toBeInstanceOf(BadRequestException);
      await expect(recusa).rejects.toThrow(/empresa/i);
    });

    it('deve deixar a troca em trilha de auditoria, com o antes e o depois', async () => {
      const josué = await escopoDe(ctx.prisma, elenco.josué.id);
      const vínculo = await vínculoDe(elenco.rafael.id, elenco.brf.id);

      await team.updateMembershipRoles(josué, vínculo.id, { roles: ['EXECUTOR', 'DIRECTOR'] });

      const registro = await ctx.prisma.auditLog.findFirstOrThrow({
        where: { action: 'membership.role_changed' },
      });

      expect(registro.actorUserId).toBe(elenco.josué.id);
      expect(JSON.stringify(registro.before)).toContain('EXECUTOR');
      expect(JSON.stringify(registro.after)).toContain('DIRECTOR');
    });
  });

  // ───────────────────────────────────────────────────────────────────────────
  // 2.4 — Remover da empresa × desligar da conta
  // ───────────────────────────────────────────────────────────────────────────

  describe('sair da empresa não é sair da conta (D8)', () => {
    it('deve encerrar só aquele vínculo ao remover da empresa', async () => {
      // O Paulo atende BRF e Seara com um login só. Sair da BRF não pode
      // encerrar o trabalho dele na Seara.
      const josué = await escopoDe(ctx.prisma, elenco.josué.id);
      const naBrf = await vínculoDe(elenco.paulo.id, elenco.brf.id);

      await team.removeFromCompany(josué, naBrf.id);

      expect((await vínculoDe(elenco.paulo.id, elenco.brf.id)).isActive).toBe(false);
      expect((await vínculoDe(elenco.paulo.id, elenco.seara.id)).isActive).toBe(true);

      const paulo = await ctx.prisma.user.findUniqueOrThrow({ where: { id: elenco.paulo.id } });
      expect(paulo.status).toBe('ACTIVE');
    });

    it('deve derrubar todos os vínculos ao desligar da conta', async () => {
      const josué = await escopoDe(ctx.prisma, elenco.josué.id);

      await lifecycle.disable(josué, elenco.paulo.id, {});

      const vínculos = await ctx.prisma.membership.findMany({
        where: { userId: elenco.paulo.id },
      });

      expect(vínculos.every((v) => v.isActive === false)).toBe(true);

      const paulo = await ctx.prisma.user.findUniqueOrThrow({ where: { id: elenco.paulo.id } });
      expect(paulo.status).toBe('DISABLED');
      expect(paulo.disabledAt).not.toBeNull();
    });

    it('deve revogar as sessões de quem foi desligado', async () => {
      // Sem isto, o refresh token que a pessoa já tem continua valendo por
      // trinta dias: ela sai da empresa e segue trabalhando no sistema.
      const josué = await escopoDe(ctx.prisma, elenco.josué.id);
      await tokens.issuePair({ id: elenco.rafael.id, accountId: elenco.normatiza.id });

      await lifecycle.disable(josué, elenco.rafael.id, {});

      const sessões = await ctx.prisma.refreshToken.findMany({
        where: { userId: elenco.rafael.id },
      });

      expect(sessões.length).toBeGreaterThan(0);
      expect(sessões.every((s) => s.revokedAt !== null)).toBe(true);
    });

    it('não deve apagar a pessoa (D6)', async () => {
      // A autoria das evidências que ela entregou tem de sobreviver a ela.
      const josué = await escopoDe(ctx.prisma, elenco.josué.id);

      await lifecycle.disable(josué, elenco.rafael.id, {});

      await expect(
        ctx.prisma.user.findUnique({ where: { id: elenco.rafael.id } }),
      ).resolves.not.toBeNull();
    });
  });

  // ───────────────────────────────────────────────────────────────────────────
  // 2.5 — Sucessão
  // ───────────────────────────────────────────────────────────────────────────

  describe('sucessão (D4)', () => {
    it('deve exigir sucessor para tirar o último Gestor de uma empresa ativa', async () => {
      const josué = await escopoDe(ctx.prisma, elenco.josué.id);

      const prévia = await lifecycle.disablePreview(josué, elenco.marcos.id);

      expect(prévia.allowed).toBe(true);
      expect(prévia.requiresSuccessor).toBe(true);
      expect(prévia.successorReasons.join(' ')).toMatch(/gestor/i);
    });

    it('não deve exigir sucessor de um Executor entre vários', async () => {
      // Exigir sempre viraria burocracia na maioria dos casos — e burocracia
      // inútil é o que faz gente contornar o fluxo em vez de usá-lo.
      const josué = await escopoDe(ctx.prisma, elenco.josué.id);

      const prévia = await lifecycle.disablePreview(josué, elenco.rafael.id);

      expect(prévia.requiresSuccessor).toBe(false);
    });

    it('deve recusar o desligamento que quebra a invariante sem sucessor', async () => {
      const josué = await escopoDe(ctx.prisma, elenco.josué.id);

      await expect(lifecycle.disable(josué, elenco.marcos.id, {})).rejects.toBeInstanceOf(
        BadRequestException,
      );
    });

    it('deve oferecer como sucessor só quem já tem acesso àquela empresa (D17)', async () => {
      // Suceder adiciona o papel que faltava, nunca a empresa. Conceder acesso
      // novo como efeito colateral de um desligamento seria ampliar escopo sem
      // ninguém ter convidado — e escondido dentro de outro ato.
      await gestorDaSeara();
      const josué = await escopoDe(ctx.prisma, elenco.josué.id);

      const prévia = await lifecycle.disablePreview(josué, elenco.marcos.id);
      const candidatos = prévia.eligibleSuccessors.map((p) => p.name);

      expect(candidatos).toContain('Antonio');
      expect(candidatos).not.toContain('Gestor da Seara');
      expect(candidatos).not.toContain('Marcos');
    });

    it('não deve oferecer quem já é Gestor de outra empresa', async () => {
      // O índice parcial recusaria: papel de escopo-empresa vale em um vínculo
      // ativo só. Oferecer o candidato e falhar depois é o defeito que D14
      // existe para evitar.
      const gestorSeara = await gestorDaSeara();
      await ctx.prisma.membership.create({
        data: {
          accountId: elenco.normatiza.id,
          userId: gestorSeara.id,
          companyId: elenco.brf.id,
          roles: ['EXECUTOR'],
          executorType: 'INTERNAL',
        },
      });

      const josué = await escopoDe(ctx.prisma, elenco.josué.id);
      const prévia = await lifecycle.disablePreview(josué, elenco.marcos.id);

      expect(prévia.eligibleSuccessors.map((p) => p.name)).not.toContain('Gestor da Seara');
    });

    it('deve passar o papel ao sucessor e registrar quem sucedeu quem', async () => {
      const josué = await escopoDe(ctx.prisma, elenco.josué.id);

      await lifecycle.disable(josué, elenco.marcos.id, { successorUserId: elenco.antonio.id });

      const antonio = await vínculoDe(elenco.antonio.id, elenco.brf.id);
      expect(antonio.roles).toContain('MANAGER');

      const marcos = await ctx.prisma.user.findUniqueOrThrow({ where: { id: elenco.marcos.id } });
      expect(marcos.succeededByUserId).toBe(elenco.antonio.id);
    });

    it('deve repassar ao sucessor quem estava abaixo na árvore de convites', async () => {
      // "Nada fica órfão" ([01 §5]): o executor convidado pelo Marcos não pode
      // ficar apontando para alguém que saiu.
      await ctx.prisma.user.update({
        where: { id: elenco.rafael.id },
        data: { invitedByUserId: elenco.marcos.id },
      });
      const josué = await escopoDe(ctx.prisma, elenco.josué.id);

      await lifecycle.disable(josué, elenco.marcos.id, { successorUserId: elenco.antonio.id });

      const rafael = await ctx.prisma.user.findUniqueOrThrow({ where: { id: elenco.rafael.id } });
      expect(rafael.invitedByUserId).toBe(elenco.antonio.id);
    });

    it('deve recusar sucessor que não estava entre os elegíveis', async () => {
      const gestorSeara = await gestorDaSeara();
      const josué = await escopoDe(ctx.prisma, elenco.josué.id);

      await expect(
        lifecycle.disable(josué, elenco.marcos.id, { successorUserId: gestorSeara.id }),
      ).rejects.toBeInstanceOf(BadRequestException);
    });
  });

  // ───────────────────────────────────────────────────────────────────────────
  // 2.6 — Alçada do desligamento
  // ───────────────────────────────────────────────────────────────────────────

  describe('quem pode desligar', () => {
    it('deve permitir desligar quem não se convidou (D5)', async () => {
      // A alçada é papel e escopo, nunca a árvore de convites: senão o executor
      // convidado por quem já saiu ficaria ativo e órfão.
      const josué = await escopoDe(ctx.prisma, elenco.josué.id);
      await ctx.prisma.user.update({
        where: { id: elenco.rafael.id },
        data: { invitedByUserId: elenco.marcos.id },
      });

      await expect(lifecycle.disable(josué, elenco.rafael.id, {})).resolves.toBeUndefined();
    });

    it('não deve deixar o lado cliente desligar da conta', async () => {
      // O Marcos tira alguém da BRF; ele não apaga essa pessoa da Normatiza.
      const marcos = await escopoDe(ctx.prisma, elenco.marcos.id);

      await expect(lifecycle.disable(marcos, elenco.rafael.id, {})).rejects.toBeInstanceOf(
        ForbiddenException,
      );
    });

    it('não deve desligar o titular da conta — por ninguém (D12)', async () => {
      const josué = await escopoDe(ctx.prisma, elenco.josué.id);

      await expect(lifecycle.disable(josué, elenco.josué.id, {})).rejects.toBeInstanceOf(
        ForbiddenException,
      );

      const prévia = await lifecycle.disablePreview(josué, elenco.josué.id);
      expect(prévia.allowed).toBe(false);
      expect(prévia.blockedReason).toMatch(/titular/i);
    });

    it('não deve alcançar pessoa de outra consultoria', async () => {
      const rival = await montarConsultoriaRival(ctx.prisma);
      const forasteiro = await ctx.prisma.user.create({
        data: {
          accountId: rival.conta.id,
          name: 'Gente da Rival',
          email: 'alguem@rival.com',
          status: 'ACTIVE',
        },
      });

      const josué = await escopoDe(ctx.prisma, elenco.josué.id);

      await expect(lifecycle.disable(josué, forasteiro.id, {})).rejects.toBeInstanceOf(
        NotFoundException,
      );
      expect(
        (await ctx.prisma.user.findUniqueOrThrow({ where: { id: forasteiro.id } })).status,
      ).toBe('ACTIVE');
    });
  });

  // ───────────────────────────────────────────────────────────────────────────
  // 2.7 — Perfil próprio
  // ───────────────────────────────────────────────────────────────────────────

  describe('o próprio perfil', () => {
    it('deve deixar a pessoa editar nome e telefone', async () => {
      await profile.updateProfile(elenco.marcos.id, {
        name: 'Marcos Silva',
        phone: '(47) 99999-0000',
      });

      const marcos = await ctx.prisma.user.findUniqueOrThrow({ where: { id: elenco.marcos.id } });

      expect(marcos.name).toBe('Marcos Silva');
      expect(marcos.phone).toBe('(47) 99999-0000');
    });

    it('não deve deixar ninguém trocar o e-mail (D7)', async () => {
      // Mudar o e-mail de um login é passar a receber os links de redefinição
      // dele — na prática, assumir a conta. O corpo chega do lado de fora e não
      // é confiável: o campo precisa ser ignorado, não só ausente do tipo.
      await profile.updateProfile(elenco.marcos.id, {
        name: 'Marcos Silva',
        email: 'invasor@exemplo.com',
      } as never);

      const marcos = await ctx.prisma.user.findUniqueOrThrow({ where: { id: elenco.marcos.id } });
      expect(marcos.email).toBe('marcos@brf.com');
    });

    it('não deve deixar mudar de conta por um campo do corpo', async () => {
      const rival = await montarConsultoriaRival(ctx.prisma);

      await profile.updateProfile(elenco.marcos.id, {
        name: 'Marcos',
        accountId: rival.conta.id,
        status: 'DISABLED',
      } as never);

      const marcos = await ctx.prisma.user.findUniqueOrThrow({ where: { id: elenco.marcos.id } });

      expect(marcos.accountId).toBe(elenco.normatiza.id);
      expect(marcos.status).toBe('ACTIVE');
    });

    it('deve exigir a senha atual para trocar de senha', async () => {
      // Uma aba esquecida aberta não pode bastar para trocar a credencial
      // permanente de alguém.
      await expect(
        profile.changePassword(elenco.marcos.id, {
          currentPassword: 'chute-errado',
          newPassword: 'senha-nova-123456',
        }),
      ).rejects.toBeInstanceOf(UnauthorizedException);

      // E a senha antiga continua valendo — recusar sem preservar seria pior.
      const marcos = await ctx.prisma.user.findUniqueOrThrow({ where: { id: elenco.marcos.id } });
      const antiga = await ctx.app
        .get(PasswordService)
        .verify({ hash: marcos.passwordHash, algo: marcos.passwordAlgo }, elenco.marcos.senha);
      expect(antiga.valid).toBe(true);
    });

    it('deve trocar a senha e derrubar as sessões abertas', async () => {
      const senhas = ctx.app.get(PasswordService);
      await tokens.issuePair({ id: elenco.marcos.id, accountId: elenco.normatiza.id });

      await profile.changePassword(elenco.marcos.id, {
        currentPassword: elenco.marcos.senha,
        newPassword: 'senha-nova-123456',
      });

      const marcos = await ctx.prisma.user.findUniqueOrThrow({ where: { id: elenco.marcos.id } });
      const confere = await senhas.verify(
        { hash: marcos.passwordHash, algo: marcos.passwordAlgo },
        'senha-nova-123456',
      );
      expect(confere.valid).toBe(true);

      const sessões = await ctx.prisma.refreshToken.findMany({
        where: { userId: elenco.marcos.id },
      });
      expect(sessões.every((s) => s.revokedAt !== null)).toBe(true);
    });
  });

  // ───────────────────────────────────────────────────────────────────────────
  // 2.9 — O que a lista oferece é o que a mutação aceita
  // ───────────────────────────────────────────────────────────────────────────

  describe('as ações oferecidas concordam com o servidor (D13)', () => {
    it('deve recusar toda mutação que a própria listagem marcou como indisponível', async () => {
      // Um botão oferecido e recusado é o mesmo defeito que um botão escondido
      // sem motivo: nos dois casos a tela e o servidor discordam.
      const marcos = await escopoDe(ctx.prisma, elenco.marcos.id);
      const equipe = await team.listCompanyMembers(marcos, elenco.brf.id);

      const carla = equipe.find((m) => m.name === 'Carla');
      expect(carla?.actions.changeRoles).toBe(false);
      expect(carla?.actions.removeFromCompany).toBe(false);

      await expect(
        team.updateMembershipRoles(marcos, carla!.membershipId, { roles: ['TECHNICIAN'] }),
      ).rejects.toBeInstanceOf(ForbiddenException);
      await expect(team.removeFromCompany(marcos, carla!.membershipId)).rejects.toBeInstanceOf(
        ForbiddenException,
      );
    });

    it('deve aceitar a mutação que a listagem ofereceu', async () => {
      const marcos = await escopoDe(ctx.prisma, elenco.marcos.id);
      const equipe = await team.listCompanyMembers(marcos, elenco.brf.id);

      const rafael = equipe.find((m) => m.name === 'Rafael');
      expect(rafael?.actions.removeFromCompany).toBe(true);

      await expect(team.removeFromCompany(marcos, rafael!.membershipId)).resolves.toBeUndefined();
    });
  });

  // O papel oferecido pela tela é o que `CAN_INVITE` permite a quem olha — a
  // lista completa nunca aparece. A checagem vive no front (4.1); aqui fica o
  // teto que a recusa: `roles` fora da alçada não passa, venha de onde vier.
  it('deve recusar papel fora da alçada mesmo vindo direto na API', async () => {
    const antonio = await escopoDe(ctx.prisma, elenco.antonio.id);
    const vínculo = await vínculoDe(elenco.rafael.id, elenco.brf.id);

    await expect(
      team.updateMembershipRoles(antonio, vínculo.id, { roles: ['MANAGER'] }),
    ).rejects.toBeInstanceOf(ForbiddenException);
  });
});
