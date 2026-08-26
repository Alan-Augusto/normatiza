import * as request from 'supertest';

import { Elenco, SENHA_PADRÃO, montarElenco } from './helpers/elenco';
import { TestApp, createTestApp } from './helpers/test-app';

/**
 * O Contexto 0 contra o banco de verdade.
 *
 * O que estes testes fixam é o desenho central: o acesso à plataforma é uma
 * dimensão **sobreposta** ao login normal — o Josué entra com o mesmo e-mail e a
 * mesma senha de sempre, e o backoffice aparece por cima —, e ele **não** é
 * atalho para dado de cliente.
 */
describe('Admin da Plataforma (e2e)', () => {
  let ctx: TestApp;
  let elenco: Elenco;

  const http = () => request(ctx.app.getHttpServer());

  beforeAll(async () => {
    ctx = await createTestApp();
  });

  afterAll(() => ctx.close());

  beforeEach(async () => {
    elenco = await montarElenco(ctx.prisma);
  });

  async function entrar(email: string) {
    const res = await http().post('/auth/login').send({ email, password: SENHA_PADRÃO });
    return res.body.accessToken as string;
  }

  const comoAdmin = (userId: string, grantedByUserId?: string) =>
    ctx.prisma.platformAdmin.create({ data: { userId, grantedByUserId } });

  describe('o mesmo login, uma camada a mais', () => {
    it('deve marcar a sessão de quem é admin da plataforma', async () => {
      // O Josué é Engenheiro Responsável da consultoria dele **e** dono da
      // plataforma. Um e-mail, uma senha, um login.
      await comoAdmin(elenco.josué.id);
      const token = await entrar(elenco.josué.email);

      const res = await http().get('/auth/me').set('Authorization', `Bearer ${token}`);

      expect(res.status).toBe(200);
      expect(res.body.isPlatformAdmin).toBe(true);
      // E continua sendo Engenheiro Responsável: a dimensão é sobreposta, não substitui.
      expect(res.body.memberships.length).toBeGreaterThan(0);
    });

    it('não deve marcar a sessão de quem não é', async () => {
      const token = await entrar(elenco.marcos.email);

      const res = await http().get('/auth/me').set('Authorization', `Bearer ${token}`);

      expect(res.body.isPlatformAdmin).toBe(false);
    });

    it('deve deixar de marcar depois da revogação', async () => {
      await comoAdmin(elenco.josué.id);
      await ctx.prisma.platformAdmin.update({
        where: { userId: elenco.josué.id },
        data: { revokedAt: new Date() },
      });

      const token = await entrar(elenco.josué.email);
      const res = await http().get('/auth/me').set('Authorization', `Bearer ${token}`);

      expect(res.body.isPlatformAdmin).toBe(false);
    });
  });

  describe('a porta do Contexto 0', () => {
    it('deve abrir para o admin da plataforma', async () => {
      await comoAdmin(elenco.josué.id);
      const token = await entrar(elenco.josué.email);

      const res = await http().get('/platform/admins').set('Authorization', `Bearer ${token}`);

      expect(res.status).toBe(200);
      expect(res.body).toHaveLength(1);
      expect(res.body[0].email).toBe(elenco.josué.email);
    });

    it('deve responder 404, e não 403, para quem não é admin', async () => {
      // Mesmo motivo do isolamento de conta: para quem está de fora, o
      // backoffice não é proibido — ele não existe. "Proibido" confirmaria que
      // há algo ali.
      const token = await entrar(elenco.josué.email);

      const res = await http().get('/platform/admins').set('Authorization', `Bearer ${token}`);

      expect(res.status).toBe(404);
    });

    it('deve recusar quem não está autenticado', async () => {
      const res = await http().get('/platform/admins');
      expect(res.status).toBe(401);
    });

    it('não deve abrir para o Engenheiro Responsável só por ele ser dono da conta', async () => {
      // Ser dono da consultoria não é ser dono da plataforma.
      const token = await entrar(elenco.josué.email);
      const res = await http().post('/platform/admins').set('Authorization', `Bearer ${token}`).send({
        userId: elenco.carla.id,
      });

      expect(res.status).toBe(404);
      await expect(ctx.prisma.platformAdmin.count()).resolves.toBe(0);
    });
  });

  describe('conceder e revogar', () => {
    it('deve conceder registrando quem concedeu', async () => {
      await comoAdmin(elenco.josué.id);
      const token = await entrar(elenco.josué.email);

      const res = await http()
        .post('/platform/admins')
        .set('Authorization', `Bearer ${token}`)
        .send({ userId: elenco.carla.id });

      expect(res.status).toBe(204);
      const concessão = await ctx.prisma.platformAdmin.findUnique({
        where: { userId: elenco.carla.id },
      });
      expect(concessão?.grantedByUserId).toBe(elenco.josué.id);
      expect(concessão?.revokedAt).toBeNull();
    });

    it('deve conceder a quem está em qualquer conta', async () => {
      // O admin da plataforma mora dentro de uma consultoria de propósito — é o
      // que permite um e-mail só para quem é as duas coisas.
      await comoAdmin(elenco.josué.id);
      const token = await entrar(elenco.josué.email);

      await http()
        .post('/platform/admins')
        .set('Authorization', `Bearer ${token}`)
        .send({ userId: elenco.marcos.id })
        .expect(204);

      const marcos = await entrar(elenco.marcos.email);
      const res = await http().get('/auth/me').set('Authorization', `Bearer ${marcos}`);
      expect(res.body.isPlatformAdmin).toBe(true);
    });

    it('deve revogar sem apagar a linha', async () => {
      await comoAdmin(elenco.josué.id);
      await comoAdmin(elenco.carla.id, elenco.josué.id);
      const token = await entrar(elenco.josué.email);

      await http()
        .delete(`/platform/admins/${elenco.carla.id}`)
        .set('Authorization', `Bearer ${token}`)
        .expect(204);

      const concessão = await ctx.prisma.platformAdmin.findUnique({
        where: { userId: elenco.carla.id },
      });
      expect(concessão).not.toBeNull();
      expect(concessão?.revokedAt).toBeInstanceOf(Date);
    });

    it('deve impedir que o admin revogue a si mesmo', async () => {
      await comoAdmin(elenco.josué.id);
      const token = await entrar(elenco.josué.email);

      const res = await http()
        .delete(`/platform/admins/${elenco.josué.id}`)
        .set('Authorization', `Bearer ${token}`);

      expect(res.status).toBe(403);
    });

    it('deve deixar a concessão e a revogação na trilha de auditoria', async () => {
      await comoAdmin(elenco.josué.id);
      const token = await entrar(elenco.josué.email);

      await http()
        .post('/platform/admins')
        .set('Authorization', `Bearer ${token}`)
        .send({ userId: elenco.carla.id })
        .expect(204);
      await http()
        .delete(`/platform/admins/${elenco.carla.id}`)
        .set('Authorization', `Bearer ${token}`)
        .expect(204);

      const trilha = await ctx.prisma.auditLog.findMany({
        where: { entityType: 'PlatformAdmin' },
        orderBy: { occurredAt: 'asc' },
      });

      expect(trilha.map((e) => e.action)).toEqual([
        'platform_admin.granted',
        'platform_admin.revoked',
      ]);
      expect(trilha.every((e) => e.actorUserId === elenco.josué.id)).toBe(true);
    });
  });

  describe('o admin não é atalho para dado de cliente', () => {
    it('não deve enxergar empresa de conta alheia', async () => {
      // Isto é o que sustenta o desenho: o isolamento de conta **não ganha
      // exceção** para o admin. Para olhar dentro de um cliente, ele usa a
      // impersonação auditada — que deixa rastro com nome.
      const rival = await ctx.prisma.account.create({
        data: { name: 'Consultoria Rival', document: '99.999.999/0001-99' },
      });
      const empresaDaRival = await ctx.prisma.company.create({
        data: {
          accountId: rival.id,
          corporateName: 'Cliente da Rival S.A.',
          tradeName: 'Rival Cliente',
          document: '88.888.888/0001-88',
        },
      });

      await comoAdmin(elenco.josué.id);
      const token = await entrar(elenco.josué.email);

      const res = await http().get('/auth/me').set('Authorization', `Bearer ${token}`);
      const empresas = res.body.memberships.map((m: { companyId: string }) => m.companyId);

      expect(empresas).not.toContain(empresaDaRival.id);
      expect(res.body.account.id).toBe(elenco.normatiza.id);
    });
  });
});
