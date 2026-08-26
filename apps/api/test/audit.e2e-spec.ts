import * as request from 'supertest';

import { Elenco, SENHA_PADRÃO, escopoDe, montarElenco } from './helpers/elenco';
import { TestApp, createTestApp } from './helpers/test-app';
import { AuditAction } from '../src/audit/audit.service';
import { TokenService } from '../src/auth/token.service';
import { InvitationsService } from '../src/invitations/invitations.service';

/**
 * A trilha de auditoria é prova ([05 §2](../../../docs/produto/05_regras_transversais.md)).
 * Se um evento de identidade não deixa rastro, ele não aconteceu do ponto de
 * vista de quem precisa auditar depois.
 */
describe('Trilha de auditoria (e2e)', () => {
  let ctx: TestApp;
  let elenco: Elenco;

  const http = () => request(ctx.app.getHttpServer());
  const registros = (action: string) =>
    ctx.prisma.auditLog.findMany({ where: { action }, orderBy: { occurredAt: 'asc' } });

  beforeAll(async () => {
    ctx = await createTestApp();
  });

  afterAll(async () => {
    await ctx.close();
  });

  beforeEach(async () => {
    elenco = await montarElenco(ctx.prisma);
  });

  describe('autenticação', () => {
    it('deve registrar quem entrou, em qual conta', async () => {
      await http()
        .post('/auth/login')
        .send({ email: elenco.marcos.email, password: SENHA_PADRÃO })
        .expect(200);

      const [registro] = await registros(AuditAction.LOGIN);

      expect(registro.actorUserId).toBe(elenco.marcos.id);
      expect(registro.accountId).toBe(elenco.normatiza.id);
    });

    it('deve registrar a tentativa fracassada de quem existe', async () => {
      await http()
        .post('/auth/login')
        .send({ email: elenco.marcos.email, password: 'chute' })
        .expect(401);

      const [registro] = await registros(AuditAction.LOGIN_FAILED);

      expect(registro).toBeDefined();
    });

    it('deve registrar tentativa com e-mail que não existe, sem inventar autor', async () => {
      // É justamente o evento sem autor que interessa a quem investiga um ataque.
      await http()
        .post('/auth/login')
        .send({ email: 'ninguem@lugar.com', password: 'chute' })
        .expect(401);

      const [registro] = await registros(AuditAction.LOGIN_FAILED);

      expect(registro).toBeDefined();
      expect(registro.actorUserId).toBeNull();
    });

    it('nunca deve gravar a senha na trilha', async () => {
      await http()
        .post('/auth/login')
        .send({ email: elenco.marcos.email, password: SENHA_PADRÃO })
        .expect(200);
      await http()
        .post('/auth/login')
        .send({ email: elenco.marcos.email, password: 'chute' })
        .expect(401);

      const todos = await ctx.prisma.auditLog.findMany();

      expect(JSON.stringify(todos)).not.toContain(SENHA_PADRÃO);
      expect(JSON.stringify(todos)).not.toContain('chute');
    });

    it('deve registrar o logout', async () => {
      const login = await http()
        .post('/auth/login')
        .send({ email: elenco.marcos.email, password: SENHA_PADRÃO });

      await http()
        .post('/auth/logout')
        .set('Cookie', login.headers['set-cookie'] as unknown as string[])
        .expect(204);

      expect(await registros(AuditAction.LOGOUT)).toHaveLength(1);
    });
  });

  describe('sessão', () => {
    it('deve registrar a detecção de reúso de refresh token', async () => {
      // O evento que dispara investigação de roubo de sessão.
      const tokens = ctx.app.get(TokenService);
      const primeiro = await tokens.issuePair({
        id: elenco.marcos.id,
        accountId: elenco.normatiza.id,
      });
      await tokens.rotate(primeiro.refreshToken);

      await expect(tokens.rotate(primeiro.refreshToken)).rejects.toThrow();

      expect(await registros(AuditAction.TOKEN_REUSE_DETECTED)).toHaveLength(1);
    });
  });

  describe('convite', () => {
    it('deve registrar a emissão com quem convidou e quem foi convidado', async () => {
      const josué = await escopoDe(ctx.prisma, elenco.josué.id);
      const invitations = ctx.app.get(InvitationsService);

      const { invitation } = await invitations.create(josué, {
        name: 'Novo Técnico',
        email: 'tecnico@normatiza.com',
        roles: ['TECHNICIAN'],
        companyIds: [elenco.brf.id],
      });

      const [registro] = await registros(AuditAction.INVITATION_CREATED);

      expect(registro.actorUserId).toBe(elenco.josué.id);
      expect(registro.entityId).toBe(invitation.id);
    });

    it('deve registrar o aceite', async () => {
      const josué = await escopoDe(ctx.prisma, elenco.josué.id);
      const invitations = ctx.app.get(InvitationsService);

      const { token } = await invitations.create(josué, {
        name: 'Novo Técnico',
        email: 'tecnico@normatiza.com',
        roles: ['TECHNICIAN'],
        companyIds: [elenco.brf.id],
      });
      await invitations.accept(token, 'senha-nova-do-tecnico');

      expect(await registros(AuditAction.INVITATION_ACCEPTED)).toHaveLength(1);
    });

    it('nunca deve gravar o token do convite na trilha', async () => {
      const josué = await escopoDe(ctx.prisma, elenco.josué.id);
      const invitations = ctx.app.get(InvitationsService);

      const { token } = await invitations.create(josué, {
        name: 'Novo Técnico',
        email: 'tecnico@normatiza.com',
        roles: ['TECHNICIAN'],
        companyIds: [elenco.brf.id],
      });

      const todos = await ctx.prisma.auditLog.findMany();
      expect(JSON.stringify(todos)).not.toContain(token);
    });
  });

  describe('senha', () => {
    it('deve registrar o pedido de redefinição', async () => {
      await http()
        .post('/auth/forgot-password')
        .send({ email: elenco.marcos.email })
        .expect(202);

      expect(await registros(AuditAction.PASSWORD_RESET_REQUESTED)).toHaveLength(1);
    });

    it('não deve registrar pedido para e-mail inexistente como se fosse alguém', async () => {
      await http()
        .post('/auth/forgot-password')
        .send({ email: 'ninguem@lugar.com' })
        .expect(202);

      const registrados = await registros(AuditAction.PASSWORD_RESET_REQUESTED);
      expect(registrados).toHaveLength(0);
    });
  });
});
