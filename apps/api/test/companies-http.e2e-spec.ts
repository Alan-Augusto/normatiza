import * as request from 'supertest';

import { Elenco, montarConsultoriaRival, montarElenco } from './helpers/elenco';
import { TestApp, createTestApp } from './helpers/test-app';
import { TokenService } from '../src/auth/token.service';

/**
 * A casca HTTP do cadastro de empresas.
 *
 * As regras estão provadas em `companies.e2e-spec.ts`, no nível de serviço.
 * Aqui fica o que só existe no transporte: quem entra sem token, o que o corpo
 * consegue colocar para dentro, e o upload.
 */
describe('Cadastro de empresas — HTTP (e2e)', () => {
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

  async function como(pessoa: { id: string }) {
    const { accessToken } = await tokens.issuePair({ id: pessoa.id, accountId: elenco.normatiza.id });
    return `Bearer ${accessToken}`;
  }

  const corpo = (over: Record<string, unknown> = {}) => ({
    corporateName: 'JBS S.A.',
    tradeName: 'JBS',
    document: '44.444.444/0001-91',
    contact: { name: 'Otávio Lima', email: 'otavio@jbs.com' },
    address: {
      zipCode: '01310-100',
      street: 'Avenida Paulista',
      number: '1000',
      district: 'Bela Vista',
      city: 'São Paulo',
      state: 'SP',
    },
    ...over,
  });

  const PNG = Buffer.concat([
    Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]),
    Buffer.alloc(64),
  ]);

  describe('sem sessão não se passa', () => {
    it('deve recusar todas as rotas a quem não apresentou token', async () => {
      await http().get('/companies').expect(401);
      await http().get(`/companies/${elenco.brf.id}`).expect(401);
      await http().post('/companies').send(corpo()).expect(401);
      await http().patch(`/companies/${elenco.brf.id}`).send(corpo()).expect(401);
      await http().post(`/companies/${elenco.brf.id}/deactivate`).expect(401);
      await http().post(`/companies/${elenco.brf.id}/reactivate`).expect(401);
      await http().put(`/companies/${elenco.brf.id}/logo`).expect(401);
      await http().delete(`/companies/${elenco.brf.id}/logo`).expect(401);
      await http().get('/company-groups').expect(401);
    });
  });

  describe('cadastrar', () => {
    it('deve criar e devolver a visão da consultoria', async () => {
      const res = await http()
        .post('/companies')
        .set('Authorization', await como(elenco.josué))
        .send(corpo())
        .expect(201);

      expect(res.body).toMatchObject({ view: 'CONSULTANCY', tradeName: 'JBS', status: 'IMPLANTATION' });
    });

    it('deve recusar cada obrigatório que falta, nomeando o campo', async () => {
      const token = await como(elenco.josué);
      const sem = (caminho: string[]) => {
        const c = corpo() as Record<string, any>;
        if (caminho.length === 1) delete c[caminho[0]];
        else delete c[caminho[0]][caminho[1]];
        return c;
      };

      for (const caminho of [
        ['corporateName'],
        ['tradeName'],
        ['document'],
        ['contact', 'name'],
        ['contact', 'email'],
        ['address', 'zipCode'],
        ['address', 'street'],
        ['address', 'number'],
        ['address', 'district'],
        ['address', 'city'],
        ['address', 'state'],
      ]) {
        const res = await http().post('/companies').set('Authorization', token).send(sem(caminho));
        expect({ caminho, status: res.status }).toEqual({ caminho, status: 400 });
        expect(JSON.stringify(res.body.message)).toContain(caminho[caminho.length - 1]);
      }
    });

    it('deve recusar CNPJ inválido, e-mail malformado, CEP incompleto e UF que não existe', async () => {
      const token = await como(elenco.josué);

      for (const errado of [
        corpo({ document: '44.444.444/0001-92' }),
        corpo({ contact: { name: 'Otávio', email: 'otavio@' } }),
        corpo({ address: { ...corpo().address, zipCode: '0131' } }),
        corpo({ address: { ...corpo().address, state: 'XX' } }),
      ]) {
        await http().post('/companies').set('Authorization', token).send(errado).expect(400);
      }
    });

    it('deve responder 409 no CNPJ repetido, dizendo que o problema é o CNPJ', async () => {
      const token = await como(elenco.josué);
      await http().post('/companies').set('Authorization', token).send(corpo()).expect(201);

      const res = await http().post('/companies').set('Authorization', token).send(corpo()).expect(409);

      expect(res.body.field).toBe('document');
    });

    it('não deve deixar o corpo escolher o que é do servidor', async () => {
      // Conta, status e desativação não se escrevem por formulário.
      const res = await http()
        .post('/companies')
        .set('Authorization', await como(elenco.josué))
        .send({ ...corpo(), accountId: 'outra', deactivatedAt: new Date().toISOString() })
        .expect(400);

      expect(JSON.stringify(res.body.message)).toMatch(/accountId|deactivatedAt/);
    });
  });

  describe('ler', () => {
    it('deve listar com as ações por linha', async () => {
      const res = await http().get('/companies').set('Authorization', await como(elenco.josué)).expect(200);

      expect(res.body).toHaveLength(2);
      expect(res.body[0]).toHaveProperty('actions');
    });

    it('deve recusar filtro de status que não existe', async () => {
      await http()
        .get('/companies?status=EXTINTA')
        .set('Authorization', await como(elenco.josué))
        .expect(400);
    });

    it('deve responder 404 para empresa de outra conta', async () => {
      const rival = await montarConsultoriaRival(ctx.prisma);
      const token = await como(elenco.josué);

      // Primeiro a própria: sem isto, uma rota que não existisse também daria
      // 404, e o teste passaria contra implementação nenhuma.
      await http().get(`/companies/${elenco.brf.id}`).set('Authorization', token).expect(200);
      await http().get(`/companies/${rival.empresa.id}`).set('Authorization', token).expect(404);
    });

    it('deve listar os grupos da carteira', async () => {
      await http()
        .get('/company-groups?q=brf')
        .set('Authorization', await como(elenco.carla))
        .expect(200);
    });
  });

  describe('desativar e reativar', () => {
    it('deve responder sem corpo, e recusar ao Técnico', async () => {
      await http()
        .post(`/companies/${elenco.brf.id}/deactivate`)
        .set('Authorization', await como(elenco.fernando))
        .expect(403);

      await http()
        .post(`/companies/${elenco.brf.id}/deactivate`)
        .set('Authorization', await como(elenco.josué))
        .expect(204);
      await http()
        .post(`/companies/${elenco.brf.id}/reactivate`)
        .set('Authorization', await como(elenco.josué))
        .expect(204);
    });
  });

  describe('o logo', () => {
    it('deve aceitar PNG enviado como arquivo', async () => {
      const res = await http()
        .put(`/companies/${elenco.brf.id}/logo`)
        .set('Authorization', await como(elenco.josué))
        .attach('file', PNG, { filename: 'logo.png', contentType: 'image/png' })
        .expect(200);

      expect(res.body.logoUrl).toBeTruthy();
    });

    it('deve recusar SVG mesmo declarado como imagem', async () => {
      await http()
        .put(`/companies/${elenco.brf.id}/logo`)
        .set('Authorization', await como(elenco.josué))
        .attach('file', Buffer.from('<svg xmlns="http://www.w3.org/2000/svg"></svg>'), {
          filename: 'logo.png',
          contentType: 'image/png',
        })
        .expect(400);
    });

    it('deve recusar arquivo acima de 2 MB', async () => {
      await http()
        .put(`/companies/${elenco.brf.id}/logo`)
        .set('Authorization', await como(elenco.josué))
        .attach('file', Buffer.concat([PNG, Buffer.alloc(2 * 1024 * 1024)]), {
          filename: 'logo.png',
          contentType: 'image/png',
        })
        .expect(413);
    });

    it('deve recusar requisição sem arquivo', async () => {
      await http()
        .put(`/companies/${elenco.brf.id}/logo`)
        .set('Authorization', await como(elenco.josué))
        .expect(400);
    });

    it('deve remover o logo', async () => {
      await http()
        .delete(`/companies/${elenco.brf.id}/logo`)
        .set('Authorization', await como(elenco.josué))
        .expect(204);
    });
  });
});
