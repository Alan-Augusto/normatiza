import { randomUUID } from 'node:crypto';

import * as request from 'supertest';

import { TokenService } from '../src/auth/token.service';
import { importarCatalogosDoLegado, validarArquivo } from '../src/catalogs/legacy-catalog-import';
import { sharp } from '../src/storage/sharp';
import { Elenco, montarElenco } from './helpers/elenco';
import { TestApp, createTestApp } from './helpers/test-app';

/**
 * Os pontos de risco da análise, com o HRN (docs/produto/03 §5.2,
 * docs/planos/analise-de-risco.md D11–D13).
 */
describe('Pontos de risco (e2e)', () => {
  let ctx: TestApp;
  let tokens: TokenService;
  let elenco: Elenco;
  let jpeg: Buffer;
  let cat: { origem: string; consequência: string; proteção: string; norma: string; outraNorma: string };

  beforeAll(async () => {
    ctx = await createTestApp();
    tokens = ctx.app.get(TokenService);
    jpeg = await sharp({ create: { width: 640, height: 480, channels: 3, background: '#733' } }).jpeg().toBuffer();
  });

  afterAll(async () => {
    await ctx.close();
  });

  beforeEach(async () => {
    elenco = await montarElenco(ctx.prisma);
    await importarCatalogosDoLegado(
      ctx.prisma,
      validarArquivo([
        { tabela: 'standard_title', id: 5, nome: '12.5 Sistemas de segurança' },
        { tabela: 'standard', id: 50, pai_id: 5, codigo: '12.5.1', texto: 'Conforme item 12.5.1, …' },
        { tabela: 'standard', id: 51, pai_id: 5, codigo: '12.5.2', texto: 'Conforme item 12.5.2, …' },
        { tabela: 'danger_type', id: 1, nome: 'Perigos Mecânicos' },
        { tabela: 'danger_origin', id: 10, pai_id: 1, nome: 'Partes móveis' },
        { tabela: 'danger_consequence', id: 20, pai_id: 1, nome: 'Esmagamento' },
        { tabela: 'security_type', id: 1, nome: 'Proteção Fixa' },
        { tabela: 'security', id: 30, pai_id: 1, nome: 'Grade soldada' },
      ]),
    );
    const id = async (entity: string, legacyId: number) =>
      (await ctx.prisma.legacyRef.findUniqueOrThrow({ where: { entity_legacyId: { entity, legacyId } } })).newId;
    cat = {
      origem: await id('danger_origin', 10),
      consequência: await id('danger_consequence', 20),
      proteção: await id('security', 30),
      norma: await id('standard', 50),
      outraNorma: await id('standard', 51),
    };
  });

  const http = () => request(ctx.app.getHttpServer());

  async function como(pessoa: { id: string }) {
    const { accessToken } = await tokens.issuePair({ id: pessoa.id, accountId: elenco.normatiza.id });
    return `Bearer ${accessToken}`;
  }

  /** Uma prensa na BRF com a Análise 1 aberta pelo Fernando. Devolve a base das rotas da análise. */
  async function rascunho(): Promise<{ base: string; token: string }> {
    const token = await como(elenco.fernando);
    await http().post(`/companies/${elenco.brf.id}/equipments`).set('Authorization', await como(elenco.josué)).send({ name: 'Prensa' }).expect(201);
    const base = `/companies/${elenco.brf.id}/equipments/eq-0001/analyses`;
    await http().post(base).set('Authorization', token).expect(201);
    return { base: `${base}/1`, token };
  }

  const PONTO_COMPLETO = () => ({
    location: '  Zona de prensagem ',
    hazardOriginIds: [cat.origem],
    hazardConsequenceIds: [cat.consequência],
    existingProtectionIds: [cat.proteção],
    violatedStandardIds: [cat.norma, cat.outraNorma, cat.norma],
    // 2,5 × 8 × 6 × 1 = 120: Risco Muito Alto.
    hrn: { fe: 2.5, pe: 8, mpl: 6, np: 1 },
    safetyCategory: { severity: 2, frequency: 2, possibility: 1 },
    suggestedSolution: 'Instalar proteção móvel intertravada com chave de segurança.',
  });

  it('deve gravar o ponto pelo id do aparelho, calculando HRN e categoria no servidor', async () => {
    const { base, token } = await rascunho();
    const id = randomUUID();

    const { body } = await http().put(`${base}/risk-points/${id}`).set('Authorization', token).send(PONTO_COMPLETO()).expect(200);

    expect(body).toEqual({
      id,
      number: 1,
      location: 'Zona de prensagem',
      hazardOriginIds: [cat.origem],
      hazardConsequenceIds: [cat.consequência],
      existingProtectionIds: [cat.proteção],
      violatedStandardIds: [cat.norma, cat.outraNorma],
      currentHrn: { fe: 2.5, pe: 8, mpl: 6, np: 1, result: 120, level: 'VERY_HIGH' },
      safetyCategory: { severity: 2, frequency: 2, possibility: 1, category: 3 },
      suggestedSolution: 'Instalar proteção móvel intertravada com chave de segurança.',
    });
  });

  it('deve regravar o mesmo ponto sem duplicar, e limpar o que não vier', async () => {
    const { base, token } = await rascunho();
    const id = randomUUID();
    await http().put(`${base}/risk-points/${id}`).set('Authorization', token).send(PONTO_COMPLETO()).expect(200);

    const { body } = await http().put(`${base}/risk-points/${id}`).set('Authorization', token).send({ location: 'Zona de prensagem' }).expect(200);

    expect(body).toEqual({
      id,
      number: 1,
      location: 'Zona de prensagem',
      hazardOriginIds: [],
      hazardConsequenceIds: [],
      existingProtectionIds: [],
      violatedStandardIds: [],
    });
    expect(await ctx.prisma.riskPoint.count()).toBe(1);
  });

  it('deve mostrar na lista de análises quantos pontos há e o pior HRN', async () => {
    const { base, token } = await rascunho();
    await http().put(`${base}/risk-points/${randomUUID()}`).set('Authorization', token).send(PONTO_COMPLETO()).expect(200);
    await http()
      .put(`${base}/risk-points/${randomUUID()}`)
      .set('Authorization', token)
      .send({ location: 'Painel', hrn: { fe: 1, pe: 1, mpl: 0.5, np: 1 } })
      .expect(200);
    await http().put(`${base}/risk-points/${randomUUID()}`).set('Authorization', token).send({ location: 'Sem HRN ainda' }).expect(200);

    const lista = await http().get(`/companies/${elenco.brf.id}/equipments/eq-0001/analyses`).set('Authorization', token).expect(200);
    const detalhe = await http().get(base).set('Authorization', token).expect(200);

    expect(lista.body[0]).toMatchObject({ riskPointsCount: 3, worstHrn: { result: 120, level: 'VERY_HIGH' } });
    expect(detalhe.body.riskPoints.map((p: { number: number; location: string }) => [p.number, p.location])).toEqual([
      [1, 'Zona de prensagem'],
      [2, 'Painel'],
      [3, 'Sem HRN ainda'],
    ]);
  });

  it('não deve aceitar HRN pela metade, nem peso fora da tabela', async () => {
    const { base, token } = await rascunho();

    await http().put(`${base}/risk-points/${randomUUID()}`).set('Authorization', token).send({ hrn: { fe: 2.5, pe: 8, mpl: 6 } }).expect(400);
    const fora = await http().put(`${base}/risk-points/${randomUUID()}`).set('Authorization', token).send({ hrn: { fe: 3, pe: 8, mpl: 6, np: 1 } }).expect(400);

    expect(fora.body).toMatchObject({ field: 'hrn', message: expect.stringContaining('FE') });
  });

  it('deve exigir frequência e possibilidade na categoria quando o ferimento é sério', async () => {
    const { base, token } = await rascunho();

    const { body } = await http()
      .put(`${base}/risk-points/${randomUUID()}`)
      .set('Authorization', token)
      .send({ safetyCategory: { severity: 2, frequency: 1 } })
      .expect(400);

    expect(body.field).toBe('safetyCategory');
  });

  it('deve recusar item que não existe no catálogo, dizendo qual lista', async () => {
    const { base, token } = await rascunho();

    const { body } = await http()
      .put(`${base}/risk-points/${randomUUID()}`)
      .set('Authorization', token)
      .send({ violatedStandardIds: [cat.norma, 'nao-existe'] })
      .expect(400);

    expect(body.field).toBe('violatedStandardIds');
  });

  it('deve renumerar os seguintes ao excluir um ponto', async () => {
    const { base, token } = await rascunho();
    const ids = [randomUUID(), randomUUID(), randomUUID()];
    for (const [i, id] of ids.entries()) {
      await http().put(`${base}/risk-points/${id}`).set('Authorization', token).send({ location: `P${i + 1}` }).expect(200);
    }

    await http().delete(`${base}/risk-points/${ids[0]}`).set('Authorization', token).expect(204);

    const { body } = await http().get(base).set('Authorization', token).expect(200);
    expect(body.riskPoints.map((p: { number: number; location: string }) => [p.number, p.location])).toEqual([
      [1, 'P2'],
      [2, 'P3'],
    ]);
  });

  it('deve guardar a foto do perigo e apagá-la junto com o ponto', async () => {
    const { base, token } = await rascunho();
    const id = randomUUID();
    await http().put(`${base}/risk-points/${id}`).set('Authorization', token).send({ location: 'Zona' }).expect(200);

    const foto = await http().put(`${base}/risk-points/${id}/photo`).set('Authorization', token).attach('file', jpeg, 'perigo.jpg').expect(200);
    expect(foto.body.thumbnailUrl).toBeTruthy();
    const { body } = await http().get(base).set('Authorization', token).expect(200);
    expect(body.riskPoints[0].photo).toBeDefined();

    await http().delete(`${base}/risk-points/${id}`).set('Authorization', token).expect(204);
    expect(await ctx.prisma.fileAsset.count()).toBe(0);
  });

  it('deve levar os pontos e as fotos deles ao descartar o rascunho', async () => {
    const { base, token } = await rascunho();
    const id = randomUUID();
    await http().put(`${base}/risk-points/${id}`).set('Authorization', token).send(PONTO_COMPLETO()).expect(200);
    await http().put(`${base}/risk-points/${id}/photo`).set('Authorization', token).attach('file', jpeg, 'perigo.jpg').expect(200);

    await http().delete(base).set('Authorization', token).expect(204);

    expect(await ctx.prisma.riskPoint.count()).toBe(0);
    expect(await ctx.prisma.fileAsset.count()).toBe(0);
  });

  it('não deve deixar o cliente gravar ponto, nem gravar em análise concluída', async () => {
    const { base, token } = await rascunho();

    await http().put(`${base}/risk-points/${randomUUID()}`).set('Authorization', await como(elenco.antonio)).send({}).expect(403);

    await ctx.prisma.analysis.updateMany({ data: { status: 'CONCLUDED', concludedAt: new Date() } });
    await http().put(`${base}/risk-points/${randomUUID()}`).set('Authorization', token).send({}).expect(409);
  });

  it('deve recusar id que não é UUID, e id que já é ponto de outra análise', async () => {
    const { base, token } = await rascunho();
    await http().put(`${base}/risk-points/ponto-1`).set('Authorization', token).send({}).expect(400);

    const id = randomUUID();
    await http().put(`${base}/risk-points/${id}`).set('Authorization', token).send({}).expect(200);
    await http().post(`/companies/${elenco.brf.id}/equipments`).set('Authorization', await como(elenco.josué)).send({ name: 'Torno' }).expect(201);
    const outra = `/companies/${elenco.brf.id}/equipments/eq-0002/analyses`;
    await http().post(outra).set('Authorization', token).expect(201);

    await http().put(`${outra}/1/risk-points/${id}`).set('Authorization', token).send({}).expect(409);
  });
});
