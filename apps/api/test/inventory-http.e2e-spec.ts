import * as request from 'supertest';

import { sharp } from '../src/storage/sharp';
import { TokenService } from '../src/auth/token.service';
import { Elenco, montarElenco } from './helpers/elenco';
import { TestApp, createTestApp } from './helpers/test-app';

/**
 * O inventário pela porta HTTP: rotas, validação do corpo e o envio da foto
 * como arquivo. As regras estão em `inventory.e2e-spec.ts`; aqui, o transporte.
 */
describe('Inventário — HTTP (e2e)', () => {
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
  const base = () => `/companies/${elenco.brf.id}/equipments`;

  async function como(pessoa: { id: string }) {
    const { accessToken } = await tokens.issuePair({ id: pessoa.id, accountId: elenco.normatiza.id });
    return `Bearer ${accessToken}`;
  }

  it('deve recusar todas as rotas a quem não apresentou token', async () => {
    for (const rota of [base(), `/companies/${elenco.brf.id}/sectors`, '/machine-types']) {
      await http().get(rota).expect(401);
    }
  });

  it('deve cadastrar, abrir pelo código da URL e listar', async () => {
    const token = await como(elenco.fernando);

    const criada = await http().post(base()).set('Authorization', token).send({ name: 'Prensa' }).expect(201);
    expect(criada.body.code).toBe('EQ-0001');

    await http().get(`${base()}/eq-0001`).set('Authorization', token).expect(200);
    const lista = await http().get(base()).set('Authorization', token).expect(200);
    expect(lista.body).toHaveLength(1);
  });

  it('não deve deixar o corpo escolher o que é do servidor', async () => {
    const res = await http()
      .post(base())
      .set('Authorization', await como(elenco.josué))
      .send({ name: 'Prensa', code: 'EQ-9999', companyId: elenco.seara.id })
      .expect(400);

    expect(JSON.stringify(res.body.message)).toMatch(/code|companyId/);
  });

  it('deve recusar ano de fabricação que não é número, e filtro de status que não existe', async () => {
    const token = await como(elenco.josué);

    await http().post(base()).set('Authorization', token).send({ name: 'X', manufactureYear: 'antigo' }).expect(400);
    await http().get(`${base()}?status=QUEBRADO`).set('Authorization', token).expect(400);
  });

  it('deve validar a ficha do ativo no corpo: número onde é número, fonte de energia que existe', async () => {
    const token = await como(elenco.josué);

    for (const sheet of [
      { energySources: ['NUCLEAR'] },
      { energySources: [], powerKw: 'muita' },
      { energySources: [], dimensions: { heightMm: -1 } },
      { energySources: [], manufacturer: { zipCode: '123' } },
    ]) {
      await http().post(base()).set('Authorization', token).send({ name: 'X', sheet }).expect(400);
    }
    await http()
      .post(base())
      .set('Authorization', token)
      .send({ name: 'X', sheet: { energySources: ['ELECTRIC'], powerKw: 0.75, dimensions: { heightMm: 1200 } } })
      .expect(201);
  });

  it('deve atender "duplicates" pela rota própria, e não como um código', async () => {
    const token = await como(elenco.josué);
    await http().post(base()).set('Authorization', token).send({ name: 'Esteira', serialNumber: 'S1' }).expect(201);

    const res = await http().get(`${base()}/duplicates?serialNumber=s1`).set('Authorization', token).expect(200);

    expect(res.body.serialNumber).toEqual([{ code: 'EQ-0001', name: 'Esteira' }]);
  });

  it('deve receber a foto como arquivo e devolver original e miniatura', async () => {
    const token = await como(elenco.josué);
    await http().post(base()).set('Authorization', token).send({ name: 'Prensa' }).expect(201);
    const jpeg = await sharp({ create: { width: 800, height: 600, channels: 3, background: '#555' } }).jpeg().toBuffer();

    const res = await http()
      .put(`${base()}/EQ-0001/photo`)
      .set('Authorization', token)
      .attach('file', jpeg, { filename: 'prensa.jpg', contentType: 'image/jpeg' })
      .expect(200);

    expect(res.body.photoUrl).toBeTruthy();
    expect(res.body.thumbnailUrl).toBeTruthy();
  });

  it('deve criar setor e tipo de máquina pelas rotas deles', async () => {
    const token = await como(elenco.josué);

    const setor = await http()
      .post(`/companies/${elenco.brf.id}/sectors`)
      .set('Authorization', token)
      .send({ name: 'Usinagem' })
      .expect(201);
    const tipo = await http().post('/machine-types').set('Authorization', token).send({ name: 'Tombador' }).expect(201);

    expect(setor.body).toMatchObject({ name: 'Usinagem', existing: false });
    expect(tipo.body).toMatchObject({ name: 'Tombador', global: false });
  });
});
