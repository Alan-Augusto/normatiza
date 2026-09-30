import { randomUUID } from 'node:crypto';

import * as request from 'supertest';
import { emptyPeAnswers } from '@normatiza/shared';

import { TokenService } from '../src/auth/token.service';
import { importarCatalogosDoLegado, validarArquivo } from '../src/catalogs/legacy-catalog-import';
import { sharp } from '../src/storage/sharp';
import { Elenco, montarElenco } from './helpers/elenco';
import { TestApp, createTestApp } from './helpers/test-app';

/**
 * Os PE da análise — um por dispositivo de parada de emergência, oito quesitos
 * (docs/produto/03 §5.2, 04 §4).
 */
describe('PE (e2e)', () => {
  let ctx: TestApp;
  let tokens: TokenService;
  let elenco: Elenco;
  let jpeg: Buffer;
  let norma: string;

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
        { tabela: 'standard_title', id: 6, nome: '12.6 Dispositivos de parada de emergência' },
        { tabela: 'standard', id: 60, pai_id: 6, codigo: '12.6.1', texto: 'Conforme item 12.6.1, …' },
      ]),
    );
    norma = (await ctx.prisma.legacyRef.findUniqueOrThrow({ where: { entity_legacyId: { entity: 'standard', legacyId: 60 } } })).newId;
  });

  const http = () => request(ctx.app.getHttpServer());

  async function como(pessoa: { id: string }) {
    const { accessToken } = await tokens.issuePair({ id: pessoa.id, accountId: elenco.normatiza.id });
    return `Bearer ${accessToken}`;
  }

  async function rascunho(): Promise<{ base: string; token: string }> {
    const token = await como(elenco.fernando);
    await http().post(`/companies/${elenco.brf.id}/equipments`).set('Authorization', await como(elenco.josué)).send({ name: 'Prensa' }).expect(201);
    const base = `/companies/${elenco.brf.id}/equipments/eq-0001/analyses`;
    await http().post(base).set('Authorization', token).expect(201);
    return { base: `${base}/1`, token };
  }

  it('deve gravar o PE pelo id do aparelho, com os oito quesitos e "Não" no que não veio', async () => {
    const { base, token } = await rascunho();
    const id = randomUUID();

    const { body } = await http()
      .put(`${base}/pes/${id}`)
      .set('Authorization', token)
      .send({
        location: '  Botão da lateral ',
        answers: { installedDevices: { physicalState: true, nr12Compliant: true }, manualReset: { physicalState: true } },
        violatedStandardIds: [norma, norma],
        solution: 'Trocar por botão com retenção e rearme manual.',
      })
      .expect(200);

    const respostas = emptyPeAnswers();
    respostas.installedDevices = { physicalState: true, nr12Compliant: true };
    respostas.manualReset = { physicalState: true, nr12Compliant: false };
    expect(body).toEqual({
      id,
      number: 1,
      location: 'Botão da lateral',
      answers: respostas,
      violatedStandardIds: [norma],
      solution: 'Trocar por botão com retenção e rearme manual.',
    });
    const detalhe = await http().get(base).set('Authorization', token).expect(200);
    expect(detalhe.body.pes).toEqual([body]);
  });

  it('deve regravar o mesmo PE sem duplicar, e limpar o que não vier', async () => {
    const { base, token } = await rascunho();
    const id = randomUUID();
    await http().put(`${base}/pes/${id}`).set('Authorization', token).send({ answers: { retention: { nr12Compliant: true } }, violatedStandardIds: [norma] }).expect(200);

    const { body } = await http().put(`${base}/pes/${id}`).set('Authorization', token).send({ location: 'Botão' }).expect(200);

    expect(body.answers.retention).toEqual({ physicalState: false, nr12Compliant: false });
    expect(body.violatedStandardIds).toEqual([]);
    expect(await ctx.prisma.peAssessment.count()).toBe(1);
  });

  it('deve recusar resposta que não é sim ou não, quesito que não existe, e norma fora do catálogo', async () => {
    const { base, token } = await rascunho();
    const url = `${base}/pes/${randomUUID()}`;

    await http().put(url).set('Authorization', token).send({ answers: { retention: { physicalState: 'sim' } } }).expect(400);
    await http().put(url).set('Authorization', token).send({ answers: { inventado: { physicalState: true } } }).expect(400);
    const { body } = await http().put(url).set('Authorization', token).send({ violatedStandardIds: ['nao-existe'] }).expect(400);

    expect(body.field).toBe('violatedStandardIds');
  });

  it('deve renumerar os seguintes ao excluir um PE', async () => {
    const { base, token } = await rascunho();
    const ids = [randomUUID(), randomUUID(), randomUUID()];
    for (const [i, id] of ids.entries()) {
      await http().put(`${base}/pes/${id}`).set('Authorization', token).send({ location: `E${i + 1}` }).expect(200);
    }

    await http().delete(`${base}/pes/${ids[0]}`).set('Authorization', token).expect(204);

    const { body } = await http().get(base).set('Authorization', token).expect(200);
    expect(body.pes.map((p: { number: number; location: string }) => [p.number, p.location])).toEqual([
      [1, 'E2'],
      [2, 'E3'],
    ]);
  });

  it('deve guardar a foto, trocar sem acumular e apagá-la com o PE', async () => {
    const { base, token } = await rascunho();
    const id = randomUUID();
    await http().put(`${base}/pes/${id}`).set('Authorization', token).send({}).expect(200);

    await http().put(`${base}/pes/${id}/photo`).set('Authorization', token).attach('file', jpeg, 'a.jpg').expect(200);
    await http().put(`${base}/pes/${id}/photo`).set('Authorization', token).attach('file', jpeg, 'b.jpg').expect(200);
    const { body } = await http().get(base).set('Authorization', token).expect(200);
    expect(body.pes[0].photo.thumbnailUrl).toBeTruthy();
    expect(await ctx.prisma.fileAsset.count()).toBe(1);

    await http().delete(`${base}/pes/${id}`).set('Authorization', token).expect(204);
    expect(await ctx.prisma.fileAsset.count()).toBe(0);
  });

  it('deve levar os PE e as fotos ao descartar o rascunho', async () => {
    const { base, token } = await rascunho();
    const id = randomUUID();
    await http().put(`${base}/pes/${id}`).set('Authorization', token).send({ location: 'Botão' }).expect(200);
    await http().put(`${base}/pes/${id}/photo`).set('Authorization', token).attach('file', jpeg, 'r.jpg').expect(200);

    await http().delete(base).set('Authorization', token).expect(204);

    expect(await ctx.prisma.peAssessment.count()).toBe(0);
    expect(await ctx.prisma.fileAsset.count()).toBe(0);
  });

  it('não deve deixar o cliente gravar PE, nem gravar em análise concluída, nem usar id de outra análise', async () => {
    const { base, token } = await rascunho();
    const id = randomUUID();
    await http().put(`${base}/pes/${id}`).set('Authorization', token).send({}).expect(200);
    await http().put(`${base}/pes/${randomUUID()}`).set('Authorization', await como(elenco.antonio)).send({}).expect(403);
    await http().put(`${base}/pes/pe-1`).set('Authorization', token).send({}).expect(400);

    await http().post(`/companies/${elenco.brf.id}/equipments`).set('Authorization', await como(elenco.josué)).send({ name: 'Torno' }).expect(201);
    const outra = `/companies/${elenco.brf.id}/equipments/eq-0002/analyses`;
    await http().post(outra).set('Authorization', token).expect(201);
    await http().put(`${outra}/1/pes/${id}`).set('Authorization', token).send({}).expect(409);

    await ctx.prisma.analysis.updateMany({ data: { status: 'CONCLUDED', concludedAt: new Date() } });
    await http().put(`${base}/pes/${randomUUID()}`).set('Authorization', token).send({}).expect(409);
  });
});
