import * as request from 'supertest';

import { Elenco, SENHA_PADRÃO, montarConsultoriaRival, montarElenco } from './helpers/elenco';
import { TestApp, createTestApp } from './helpers/test-app';
import {
  CLIENT_HEADER,
  CLIENT_NATIVO,
  REFRESH_COOKIE,
  REFRESH_HEADER,
} from '../src/auth/session-transport';

describe('Autenticação (e2e)', () => {
  let ctx: TestApp;
  let elenco: Elenco;

  const http = () => request(ctx.app.getHttpServer());

  beforeAll(async () => {
    ctx = await createTestApp();
  });

  afterAll(async () => {
    await ctx.close();
  });

  beforeEach(async () => {
    elenco = await montarElenco(ctx.prisma);
  });

  describe('POST /auth/login', () => {
    it('deve autenticar o Josué com as credenciais dele', async () => {
      const res = await http()
        .post('/auth/login')
        .send({ email: elenco.josué.email, password: SENHA_PADRÃO })
        .expect(200);

      expect(res.body.accessToken).toEqual(expect.any(String));
      expect(res.body.session.user.email).toBe(elenco.josué.email);
    });

    it('deve entregar o refresh token no cookie httpOnly, fora do alcance do JavaScript', async () => {
      const res = await http()
        .post('/auth/login')
        .send({ email: elenco.marcos.email, password: SENHA_PADRÃO })
        .expect(200);

      const cookie = (res.headers['set-cookie'] as unknown as string[]).find((c) =>
        c.startsWith(REFRESH_COOKIE),
      );

      expect(cookie).toBeDefined();
      expect(cookie).toMatch(/HttpOnly/i);
    });

    it('não deve devolver o refresh token no corpo para o cliente web', async () => {
      // No web ele vive só no cookie httpOnly. Devolvê-lo também no corpo
      // colocaria numa string legível pelo JavaScript exatamente o que o cookie
      // existe para esconder.
      const res = await http()
        .post('/auth/login')
        .send({ email: elenco.marcos.email, password: SENHA_PADRÃO })
        .expect(200);

      expect(JSON.stringify(res.body)).not.toContain('refreshToken');
    });

    it('deve recusar senha errada', async () => {
      await http()
        .post('/auth/login')
        .send({ email: elenco.marcos.email, password: 'chute' })
        .expect(401);
    });

    it('deve responder a e-mail inexistente exatamente como a senha errada', async () => {
      const inexistente = await http()
        .post('/auth/login')
        .send({ email: 'ninguem@lugar.com', password: 'chute' });
      const senhaErrada = await http()
        .post('/auth/login')
        .send({ email: elenco.marcos.email, password: 'chute' });

      expect(inexistente.status).toBe(senhaErrada.status);
      expect(inexistente.body.message).toEqual(senhaErrada.body.message);
    });

    it('deve recusar corpo malformado antes de tocar no banco', async () => {
      await http().post('/auth/login').send({ email: 'nao-e-email', password: 'x' }).expect(400);
    });

    it('deve descartar campo não declarado no contrato', async () => {
      await http()
        .post('/auth/login')
        .send({ email: elenco.marcos.email, password: SENHA_PADRÃO, isAdmin: true })
        .expect(400);
    });
  });

  describe('GET /auth/me', () => {
    async function entrar(email: string) {
      const res = await http().post('/auth/login').send({ email, password: SENHA_PADRÃO });
      return {
        accessToken: res.body.accessToken as string,
        cookies: res.headers['set-cookie'] as unknown as string[],
      };
    }

    it('deve recusar quem não apresenta token', async () => {
      await http().get('/auth/me').expect(401);
    });

    it('deve recusar token adulterado', async () => {
      const { accessToken } = await entrar(elenco.marcos.email);

      await http()
        .get('/auth/me')
        .set('Authorization', `Bearer ${accessToken.slice(0, -3)}xxx`)
        .expect(401);
    });

    it('deve devolver os vínculos do Marcos — só a BRF', async () => {
      const { accessToken } = await entrar(elenco.marcos.email);

      const res = await http()
        .get('/auth/me')
        .set('Authorization', `Bearer ${accessToken}`)
        .expect(200);

      expect(res.body.memberships).toHaveLength(1);
      expect(res.body.memberships[0].company.id).toBe(elenco.brf.id);
      expect(res.body.memberships[0].roles).toEqual(['MANAGER']);
    });

    it('deve devolver a carteira inteira da Carla — BRF e Seara', async () => {
      const { accessToken } = await entrar(elenco.carla.email);

      const res = await http()
        .get('/auth/me')
        .set('Authorization', `Bearer ${accessToken}`)
        .expect(200);

      expect(res.body.memberships.map((m: { company: { id: string } }) => m.company.id).sort())
        .toEqual([elenco.brf.id, elenco.seara.id].sort());
    });

    it('deve mostrar ao Paulo as duas empresas que ele atende, com um login só', async () => {
      const { accessToken } = await entrar(elenco.paulo.email);

      const res = await http()
        .get('/auth/me')
        .set('Authorization', `Bearer ${accessToken}`)
        .expect(200);

      expect(res.body.memberships).toHaveLength(2);
    });

    it('nunca deve devolver campo de credencial', async () => {
      const { accessToken } = await entrar(elenco.marcos.email);

      const res = await http()
        .get('/auth/me')
        .set('Authorization', `Bearer ${accessToken}`)
        .expect(200);

      const corpo = JSON.stringify(res.body);
      expect(corpo).not.toContain('passwordHash');
      expect(corpo).not.toContain('legacyPasswordSalt');
    });
  });

  describe('os dois transportes de sessão (D6)', () => {
    it('deve aceitar refresh pelo cookie — o caminho do painel web', async () => {
      const login = await http()
        .post('/auth/login')
        .send({ email: elenco.marcos.email, password: SENHA_PADRÃO });

      await http()
        .post('/auth/refresh')
        .set('Cookie', login.headers['set-cookie'] as unknown as string[])
        .expect(200);
    });

    it('deve entregar o refresh token no corpo quando o cliente é o app', async () => {
      // O Capacitor não tem cookie confiável: o token vai para o secure storage
      // do aparelho, e para isso precisa chegar no corpo.
      const login = await http()
        .post('/auth/login')
        .set(CLIENT_HEADER, CLIENT_NATIVO)
        .send({ email: elenco.rafael.email, password: SENHA_PADRÃO })
        .expect(200);

      expect(login.body.refreshToken).toEqual(expect.any(String));
      expect(login.headers['set-cookie']).toBeUndefined();
    });

    it('deve aceitar refresh pelo cabeçalho — o caminho do app de campo', async () => {
      const login = await http()
        .post('/auth/login')
        .set(CLIENT_HEADER, CLIENT_NATIVO)
        .send({ email: elenco.rafael.email, password: SENHA_PADRÃO });

      await http()
        .post('/auth/refresh')
        .set(CLIENT_HEADER, CLIENT_NATIVO)
        .set(REFRESH_HEADER, login.body.refreshToken as string)
        .expect(200);
    });

    it('deve recusar refresh sem token nenhum', async () => {
      await http().post('/auth/refresh').expect(401);
    });
  });

  describe('POST /auth/logout', () => {
    it('deve encerrar a sessão e impedir o refresh seguinte', async () => {
      const login = await http()
        .post('/auth/login')
        .send({ email: elenco.marcos.email, password: SENHA_PADRÃO });
      const cookies = login.headers['set-cookie'] as unknown as string[];

      await http().post('/auth/logout').set('Cookie', cookies).expect(204);
      await http().post('/auth/refresh').set('Cookie', cookies).expect(401);
    });
  });

  describe('recuperação de senha', () => {
    it('deve responder igual para e-mail existente e inexistente', async () => {
      // Dizer "não encontrei esse e-mail" é confirmar quem é cliente de quem.
      const existente = await http()
        .post('/auth/forgot-password')
        .send({ email: elenco.marcos.email });
      const inexistente = await http()
        .post('/auth/forgot-password')
        .send({ email: 'ninguem@lugar.com' });

      expect(existente.status).toBe(inexistente.status);
      expect(existente.body).toEqual(inexistente.body);
    });

    it('deve recusar token de redefinição inválido', async () => {
      await http()
        .post('/auth/reset-password')
        .send({ token: 'inventado', password: 'senha-nova-forte' })
        .expect(400);
    });

    it('deve exigir senha de tamanho mínimo ao redefinir', async () => {
      await http()
        .post('/auth/reset-password')
        .send({ token: 'qualquer', password: '123' })
        .expect(400);
    });
  });

  describe('isolamento entre contas', () => {
    it('não deve deixar o e-mail de uma consultoria autenticar na outra', async () => {
      const rival = await montarConsultoriaRival(ctx.prisma);

      const login = await http()
        .post('/auth/login')
        .send({ email: elenco.marcos.email, password: SENHA_PADRÃO })
        .expect(200);

      expect(login.body.session.account.id).toBe(elenco.normatiza.id);
      expect(login.body.session.account.id).not.toBe(rival.conta.id);
    });

    it('não deve devolver vínculo de outra conta em nenhuma hipótese', async () => {
      const rival = await montarConsultoriaRival(ctx.prisma);

      const login = await http()
        .post('/auth/login')
        .send({ email: elenco.josué.email, password: SENHA_PADRÃO });

      const res = await http()
        .get('/auth/me')
        .set('Authorization', `Bearer ${login.body.accessToken}`)
        .expect(200);

      const empresas = res.body.memberships.map((m: { company: { id: string } }) => m.company.id);
      expect(empresas).not.toContain(rival.empresa.id);
    });
  });
});
