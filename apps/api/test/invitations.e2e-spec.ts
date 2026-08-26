import { Elenco, escopoDe, montarConsultoriaRival, montarElenco } from './helpers/elenco';
import { TestApp, createTestApp } from './helpers/test-app';
import { InvitationsService } from '../src/invitations/invitations.service';

/**
 * O convite é a única porta de entrada do sistema (D15). Estes testes cobrem os
 * dois tetos que o servidor precisa impor: o de **papel** (quem convida quem) e
 * o de **escopo** (ninguém oferece empresa que não tem).
 */
describe('Convites (e2e)', () => {
  let ctx: TestApp;
  let invitations: InvitationsService;
  let elenco: Elenco;

  beforeAll(async () => {
    ctx = await createTestApp();
    invitations = ctx.app.get(InvitationsService);
  });

  afterAll(async () => {
    await ctx.close();
  });

  beforeEach(async () => {
    elenco = await montarElenco(ctx.prisma);
  });

  describe('o que o convite cria', () => {
    it('deve criar o usuário já convidado, sem senha', async () => {
      const josué = await escopoDe(ctx.prisma, elenco.josué.id);

      await invitations.create(josué, {
        name: 'Novo Técnico',
        email: 'tecnico@normatiza.com',
        roles: ['TECHNICIAN'],
        companyIds: [elenco.brf.id],
      });

      const criado = await ctx.prisma.user.findFirstOrThrow({
        where: { email: 'tecnico@normatiza.com' },
      });

      expect(criado.status).toBe('INVITED');
      expect(criado.passwordHash).toBeNull();
    });

    it('deve registrar quem convidou, para a árvore de convites', async () => {
      const marcos = await escopoDe(ctx.prisma, elenco.marcos.id);

      await invitations.create(marcos, {
        name: 'Executor Novo',
        email: 'executor@brf.com',
        roles: ['EXECUTOR'],
        companyIds: [elenco.brf.id],
        executorType: 'INTERNAL',
      });

      const criado = await ctx.prisma.user.findFirstOrThrow({
        where: { email: 'executor@brf.com' },
      });

      expect(criado.invitedByUserId).toBe(elenco.marcos.id);
    });

    it('deve guardar apenas o hash do token do convite', async () => {
      const josué = await escopoDe(ctx.prisma, elenco.josué.id);

      const { token } = await invitations.create(josué, {
        name: 'Novo Técnico',
        email: 'tecnico@normatiza.com',
        roles: ['TECHNICIAN'],
        companyIds: [elenco.brf.id],
      });

      const convite = await ctx.prisma.invitation.findFirstOrThrow();
      expect(convite.tokenHash).not.toBe(token);
    });

    it('deve criar o executor com vínculo nas várias empresas oferecidas', async () => {
      const josué = await escopoDe(ctx.prisma, elenco.josué.id);

      await invitations.create(josué, {
        name: 'Instalador Terceiro',
        email: 'instalador@ipe.com',
        roles: ['EXECUTOR'],
        companyIds: [elenco.brf.id, elenco.seara.id],
        executorType: 'THIRD_PARTY',
      });

      const criado = await ctx.prisma.user.findFirstOrThrow({
        where: { email: 'instalador@ipe.com' },
        include: { memberships: true },
      });

      expect(criado.memberships).toHaveLength(2);
    });
  });

  describe('teto de papel — quem convida quem', () => {
    it('deve deixar o Gestor convidar Engenheiro do Cliente', async () => {
      const marcos = await escopoDe(ctx.prisma, elenco.marcos.id);

      await expect(
        invitations.create(marcos, {
          name: 'Engenheiro Novo',
          email: 'eng@brf.com',
          roles: ['CLIENT_ENGINEER'],
          companyIds: [elenco.brf.id],
        }),
      ).resolves.toBeDefined();
    });

    it('não deve deixar o Gestor convidar alguém da consultoria', async () => {
      // O cliente não escala para dentro da equipe da Normatiza.
      const marcos = await escopoDe(ctx.prisma, elenco.marcos.id);

      await expect(
        invitations.create(marcos, {
          name: 'Engenheiro Infiltrado',
          email: 'infiltrado@brf.com',
          roles: ['CONSULTANT_ENGINEER'],
          companyIds: [elenco.brf.id],
        }),
      ).rejects.toThrow();
    });

    it('não deve deixar o Engenheiro do Cliente convidar um Gestor', async () => {
      // Seria criar quem aprova o próprio orçamento.
      const antonio = await escopoDe(ctx.prisma, elenco.antonio.id);

      await expect(
        invitations.create(antonio, {
          name: 'Gestor Conveniente',
          email: 'gestor2@brf.com',
          roles: ['MANAGER'],
          companyIds: [elenco.brf.id],
        }),
      ).rejects.toThrow();
    });

    it('não deve deixar o Técnico convidar ninguém', async () => {
      const fernando = await escopoDe(ctx.prisma, elenco.fernando.id);

      await expect(
        invitations.create(fernando, {
          name: 'Qualquer Um',
          email: 'qualquer@brf.com',
          roles: ['EXECUTOR'],
          companyIds: [elenco.brf.id],
        }),
      ).rejects.toThrow();
    });

    it('não deve deixar o Executor convidar ninguém', async () => {
      const rafael = await escopoDe(ctx.prisma, elenco.rafael.id);

      await expect(
        invitations.create(rafael, {
          name: 'Colega',
          email: 'colega@brf.com',
          roles: ['EXECUTOR'],
          companyIds: [elenco.brf.id],
        }),
      ).rejects.toThrow();
    });
  });

  describe('teto de escopo — delegação decrescente', () => {
    it('não deve deixar o Gestor da BRF convidar alguém para a Seara', async () => {
      const marcos = await escopoDe(ctx.prisma, elenco.marcos.id);

      await expect(
        invitations.create(marcos, {
          name: 'Executor da Seara',
          email: 'exec@seara.com',
          roles: ['EXECUTOR'],
          companyIds: [elenco.seara.id],
        }),
      ).rejects.toThrow();
    });

    it('não deve deixar convidar para empresa de outra consultoria', async () => {
      const rival = await montarConsultoriaRival(ctx.prisma);
      const josué = await escopoDe(ctx.prisma, elenco.josué.id);

      await expect(
        invitations.create(josué, {
          name: 'Espião',
          email: 'espiao@rival.com',
          roles: ['EXECUTOR'],
          companyIds: [rival.empresa.id],
        }),
      ).rejects.toThrow();
    });

    it('não deve criar nada quando o convite é recusado', async () => {
      // Recusa parcial seria pior que recusa: usuário órfão sem vínculo.
      const marcos = await escopoDe(ctx.prisma, elenco.marcos.id);

      await expect(
        invitations.create(marcos, {
          name: 'Executor da Seara',
          email: 'exec@seara.com',
          roles: ['EXECUTOR'],
          companyIds: [elenco.seara.id],
        }),
      ).rejects.toThrow();

      const órfão = await ctx.prisma.user.findFirst({ where: { email: 'exec@seara.com' } });
      expect(órfão).toBeNull();
    });
  });

  describe('aceitar o convite', () => {
    async function convidar(email = 'tecnico@normatiza.com') {
      const josué = await escopoDe(ctx.prisma, elenco.josué.id);
      return invitations.create(josué, {
        name: 'Novo Técnico',
        email,
        roles: ['TECHNICIAN'],
        companyIds: [elenco.brf.id],
      });
    }

    it('deve ativar o usuário quando ele define a senha', async () => {
      const { token } = await convidar();

      await invitations.accept(token, 'senha-nova-do-tecnico');

      const usuário = await ctx.prisma.user.findFirstOrThrow({
        where: { email: 'tecnico@normatiza.com' },
      });
      expect(usuário.status).toBe('ACTIVE');
      expect(usuário.passwordAlgo).toBe('ARGON2ID');
    });

    it('deve recusar o mesmo token na segunda vez', async () => {
      // Uso único: link vazado depois do aceite não vale nada.
      const { token } = await convidar();
      await invitations.accept(token, 'senha-nova-do-tecnico');

      await expect(invitations.accept(token, 'outra-senha-qualquer')).rejects.toThrow();
    });

    it('deve recusar token expirado', async () => {
      const { token } = await convidar();
      await ctx.prisma.invitation.updateMany({
        data: { expiresAt: new Date(Date.now() - 1000) },
      });

      await expect(invitations.accept(token, 'senha-nova-do-tecnico')).rejects.toThrow();
    });

    it('deve recusar token inventado', async () => {
      await expect(invitations.accept('nao-existe', 'senha-nova-do-tecnico')).rejects.toThrow();
    });

    it('deve recusar convite revogado', async () => {
      const { token } = await convidar();
      const josué = await escopoDe(ctx.prisma, elenco.josué.id);
      const convite = await ctx.prisma.invitation.findFirstOrThrow();

      await invitations.revoke(josué, convite.id);

      await expect(invitations.accept(token, 'senha-nova-do-tecnico')).rejects.toThrow();
    });

    it('deve invalidar o token anterior ao reenviar o convite', async () => {
      const { token: primeiro } = await convidar();
      const josué = await escopoDe(ctx.prisma, elenco.josué.id);
      const convite = await ctx.prisma.invitation.findFirstOrThrow();

      const { token: segundo } = await invitations.resend(josué, convite.id);

      await expect(invitations.accept(primeiro, 'senha-nova-do-tecnico')).rejects.toThrow();
      await expect(invitations.accept(segundo, 'senha-nova-do-tecnico')).resolves.toBeUndefined();
    });
  });
});
