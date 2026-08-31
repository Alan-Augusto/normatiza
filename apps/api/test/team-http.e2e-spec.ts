import * as request from 'supertest';

import { Elenco, montarElenco } from './helpers/elenco';
import { TestApp, createTestApp } from './helpers/test-app';
import { TokenService } from '../src/auth/token.service';

/**
 * A casca HTTP da gestão de equipe (2.8).
 *
 * As regras de negócio já estão provadas em `team.e2e-spec.ts`, no nível de
 * serviço. O que se verifica aqui é o que só existe no transporte: quem entra
 * sem token, que código sai de cada recusa, e o que o corpo da requisição
 * consegue — ou não — colocar para dentro.
 */
describe('Gestão de equipe — HTTP (e2e)', () => {
  let ctx: TestApp;
  let tokens: TokenService;
  let elenco: Elenco;

  beforeAll(async () => {
    ctx = await createTestApp();
    tokens = ctx.app.get(TokenService);
  });

  afterAll(async () => {
    await ctx.close();
  });

  beforeEach(async () => {
    elenco = await montarElenco(ctx.prisma);
  });

  const http = () => request(ctx.app.getHttpServer());

  async function comoJosué() {
    const { accessToken } = await tokens.issuePair({
      id: elenco.josué.id,
      accountId: elenco.normatiza.id,
    });
    return `Bearer ${accessToken}`;
  }

  async function comoMarcos() {
    const { accessToken } = await tokens.issuePair({
      id: elenco.marcos.id,
      accountId: elenco.normatiza.id,
    });
    return `Bearer ${accessToken}`;
  }

  describe('sem sessão não se passa', () => {
    it('deve recusar todas as rotas de equipe a quem não apresentou token', async () => {
      await http().get('/users').expect(401);
      await http().get(`/companies/${elenco.brf.id}/members`).expect(401);
      await http().patch('/memberships/qualquer').send({ roles: ['EXECUTOR'] }).expect(401);
      await http().delete('/memberships/qualquer').expect(401);
      await http().patch('/users/me').send({ name: 'X' }).expect(401);
      await http().post('/users/me/password').send({}).expect(401);
    });
  });

  describe('a listagem da conta', () => {
    it('deve devolver a equipe a quem tem sessão', async () => {
      const resposta = await http()
        .get('/users')
        .set('Authorization', await comoJosué())
        .expect(200);

      expect(resposta.body).toHaveLength(8);
      expect(resposta.body[0]).toHaveProperty('actions');
    });

    it('deve recusar filtro com valor que não existe', async () => {
      // O papel é um conjunto fechado. Um valor inventado é erro de formato, e
      // erro de formato se responde antes de qualquer consulta.
      await http()
        .get('/users?role=IMPERADOR')
        .set('Authorization', await comoJosué())
        .expect(400);
    });
  });

  describe('a listagem da empresa', () => {
    it('deve devolver quem a empresa administra, e a consultoria como contexto', async () => {
      const resposta = await http()
        .get(`/companies/${elenco.brf.id}/members`)
        .set('Authorization', await comoMarcos())
        .expect(200);

      const membros = resposta.body.members.map((m: { name: string }) => m.name);
      const responsáveis = resposta.body.technicalResponsibles.map(
        (r: { name: string }) => r.name,
      );

      // O recorte de D25 acontece no servidor: se a Carla viajasse até aqui,
      // esconder no template deixaria o cadastro dela legível no inspetor.
      expect(membros).toContain('Marcos');
      expect(membros).not.toContain('Carla');
      expect(responsáveis).toContain('Carla');
      expect(resposta.body.accountName).toBe('Normatiza');
    });

    it('deve responder 404, e não 403, para empresa fora do escopo', async () => {
      // Um 403 contaria ao Marcos que existe algo ali para ser proibido. Ele não
      // pode descobrir que a Seara existe.
      await http()
        .get(`/companies/${elenco.seara.id}/members`)
        .set('Authorization', await comoMarcos())
        .expect(404);
    });
  });

  describe('o próprio perfil', () => {
    it('deve salvar nome e telefone', async () => {
      await http()
        .patch('/users/me')
        .set('Authorization', await comoMarcos())
        .send({ name: 'Marcos Silva', phone: '(47) 99999-0000' })
        .expect(204);

      const marcos = await ctx.prisma.user.findUniqueOrThrow({ where: { id: elenco.marcos.id } });
      expect(marcos.name).toBe('Marcos Silva');
    });

    it('deve recusar o corpo que tenta trocar o e-mail (D7)', async () => {
      // Recusar, e não ignorar em silêncio: quem tentou precisa saber que aquele
      // caminho não existe, em vez de achar que funcionou.
      await http()
        .patch('/users/me')
        .set('Authorization', await comoMarcos())
        .send({ name: 'Marcos', email: 'invasor@exemplo.com' })
        .expect(400);

      const marcos = await ctx.prisma.user.findUniqueOrThrow({ where: { id: elenco.marcos.id } });
      expect(marcos.email).toBe('marcos@brf.com');
    });

    it('deve recusar o corpo que tenta mudar de conta ou de status', async () => {
      await http()
        .patch('/users/me')
        .set('Authorization', await comoMarcos())
        .send({ accountId: 'outra-conta', status: 'DISABLED' })
        .expect(400);
    });

    it('deve exigir senha nova com tamanho mínimo', async () => {
      await http()
        .post('/users/me/password')
        .set('Authorization', await comoMarcos())
        .send({ currentPassword: elenco.marcos.senha, newPassword: 'curta' })
        .expect(400);
    });

    it('deve responder 401 quando a senha atual não confere', async () => {
      await http()
        .post('/users/me/password')
        .set('Authorization', await comoMarcos())
        .send({ currentPassword: 'chute-errado', newPassword: 'senha-nova-123456' })
        .expect(401);
    });
  });

  describe('as mutações de vínculo', () => {
    it('deve responder 403 quando falta alçada', async () => {
      const carla = await ctx.prisma.membership.findFirstOrThrow({
        where: { userId: elenco.carla.id, companyId: elenco.brf.id },
      });

      await http()
        .patch(`/memberships/${carla.id}`)
        .set('Authorization', await comoMarcos())
        .send({ roles: ['TECHNICIAN'] })
        .expect(403);
    });

    it('deve responder 404 para vínculo que não existe', async () => {
      await http()
        .delete('/memberships/nao-existe')
        .set('Authorization', await comoJosué())
        .expect(404);
    });

    it('deve trocar o papel de quem está dentro da alçada', async () => {
      const rafael = await ctx.prisma.membership.findFirstOrThrow({
        where: { userId: elenco.rafael.id, companyId: elenco.brf.id },
      });

      await http()
        .patch(`/memberships/${rafael.id}`)
        .set('Authorization', await comoMarcos())
        .send({ roles: ['EXECUTOR', 'DIRECTOR'] })
        .expect(204);

      const atualizado = await ctx.prisma.membership.findUniqueOrThrow({
        where: { id: rafael.id },
      });
      expect(atualizado.roles).toContain('DIRECTOR');
    });
  });

  describe('o desligamento', () => {
    it('deve devolver a consulta prévia com os candidatos a sucessor', async () => {
      const resposta = await http()
        .get(`/users/${elenco.marcos.id}/disable-preview`)
        .set('Authorization', await comoJosué())
        .expect(200);

      expect(resposta.body.requiresSuccessor).toBe(true);
      expect(resposta.body.eligibleSuccessors.length).toBeGreaterThan(0);
    });

    it('deve responder 400 quando falta o sucessor que a prévia exigia', async () => {
      await http()
        .post(`/users/${elenco.marcos.id}/disable`)
        .set('Authorization', await comoJosué())
        .send({})
        .expect(400);
    });

    it('deve responder 403 ao desligamento do titular da conta (D12)', async () => {
      await http()
        .post(`/users/${elenco.josué.id}/disable`)
        .set('Authorization', await comoJosué())
        .send({})
        .expect(403);
    });

    it('deve desligar quem está dentro da alçada', async () => {
      await http()
        .post(`/users/${elenco.rafael.id}/disable`)
        .set('Authorization', await comoJosué())
        .send({ reason: 'saiu da empresa' })
        .expect(204);

      const rafael = await ctx.prisma.user.findUniqueOrThrow({ where: { id: elenco.rafael.id } });
      expect(rafael.status).toBe('DISABLED');
    });

    it('não deve deixar o lado cliente desligar da conta (D8)', async () => {
      await http()
        .post(`/users/${elenco.rafael.id}/disable`)
        .set('Authorization', await comoMarcos())
        .send({})
        .expect(403);
    });
  });
});
