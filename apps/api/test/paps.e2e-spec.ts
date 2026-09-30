import { randomUUID } from 'node:crypto';

import * as request from 'supertest';
import { emptyPapAnswers } from '@normatiza/shared';

import { TokenService } from '../src/auth/token.service';
import { importarCatalogosDoLegado, validarArquivo } from '../src/catalogs/legacy-catalog-import';
import { sharp } from '../src/storage/sharp';
import { Elenco, montarElenco } from './helpers/elenco';
import { TestApp, createTestApp } from './helpers/test-app';

/**
 * Os PAP da análise — um por conjunto de comando, três seções de seis quesitos
 * (docs/produto/03 §5.2, 04 §4).
 */
describe('PAP (e2e)', () => {
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
        { tabela: 'standard_title', id: 5, nome: '12.4 Dispositivos de partida' },
        { tabela: 'standard', id: 50, pai_id: 5, codigo: '12.4.1', texto: 'Conforme item 12.4.1, …' },
      ]),
    );
    norma = (await ctx.prisma.legacyRef.findUniqueOrThrow({ where: { entity_legacyId: { entity: 'standard', legacyId: 50 } } })).newId;
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

  it('deve gravar o PAP pelo id do aparelho, com as três seções completas e "Não" no que não veio', async () => {
    const { base, token } = await rascunho();
    const id = randomUUID();

    const { body } = await http()
      .put(`${base}/paps/${id}`)
      .set('Authorization', token)
      .send({
        location: '  Painel principal ',
        sections: {
          activation: { answers: { installed: { physicalState: true, nr12Compliant: true }, ebt: { physicalState: true } } },
          stop: { answers: { accidental: { nr12Compliant: true } } },
        },
        violatedStandardIds: [norma, norma],
        solution: 'Instalar botão de emergência tipo cogumelo.',
      })
      .expect(200);

    const ativação = emptyPapAnswers();
    ativação.installed = { physicalState: true, nr12Compliant: true };
    ativação.ebt = { physicalState: true, nr12Compliant: false };
    const parada = emptyPapAnswers();
    parada.accidental = { physicalState: false, nr12Compliant: true };
    expect(body).toEqual({
      id,
      number: 1,
      location: 'Painel principal',
      sections: { activation: { answers: ativação }, stop: { answers: parada }, reset: { answers: emptyPapAnswers() } },
      violatedStandardIds: [norma],
      solution: 'Instalar botão de emergência tipo cogumelo.',
    });
    const detalhe = await http().get(base).set('Authorization', token).expect(200);
    expect(detalhe.body.paps).toEqual([body]);
  });

  it('deve regravar o mesmo PAP sem duplicar, e limpar o que não vier', async () => {
    const { base, token } = await rascunho();
    const id = randomUUID();
    await http()
      .put(`${base}/paps/${id}`)
      .set('Authorization', token)
      .send({ sections: { reset: { answers: { antiFraud: { physicalState: true, nr12Compliant: false } } } }, violatedStandardIds: [norma] })
      .expect(200);

    const { body } = await http().put(`${base}/paps/${id}`).set('Authorization', token).send({ location: 'Botoeira' }).expect(200);

    expect(body.sections.reset.answers.antiFraud).toEqual({ physicalState: false, nr12Compliant: false });
    expect(body.violatedStandardIds).toEqual([]);
    expect(await ctx.prisma.papAssessment.count()).toBe(1);
  });

  it('deve recusar resposta que não é sim ou não, quesito que não existe, e norma fora do catálogo', async () => {
    const { base, token } = await rascunho();
    const url = `${base}/paps/${randomUUID()}`;

    await http().put(url).set('Authorization', token).send({ sections: { activation: { answers: { installed: { physicalState: 'sim' } } } } }).expect(400);
    await http().put(url).set('Authorization', token).send({ sections: { activation: { answers: { inventado: { physicalState: true } } } } }).expect(400);
    await http().put(url).set('Authorization', token).send({ sections: { inventada: {} } }).expect(400);
    const { body } = await http().put(url).set('Authorization', token).send({ violatedStandardIds: ['nao-existe'] }).expect(400);

    expect(body.field).toBe('violatedStandardIds');
  });

  it('deve renumerar os seguintes ao excluir um PAP', async () => {
    const { base, token } = await rascunho();
    const ids = [randomUUID(), randomUUID(), randomUUID()];
    for (const [i, id] of ids.entries()) {
      await http().put(`${base}/paps/${id}`).set('Authorization', token).send({ location: `C${i + 1}` }).expect(200);
    }

    await http().delete(`${base}/paps/${ids[1]}`).set('Authorization', token).expect(204);

    const { body } = await http().get(base).set('Authorization', token).expect(200);
    expect(body.paps.map((p: { number: number; location: string }) => [p.number, p.location])).toEqual([
      [1, 'C1'],
      [2, 'C3'],
    ]);
  });

  it('deve guardar uma foto por seção, trocar sem acumular e apagá-las com o PAP', async () => {
    const { base, token } = await rascunho();
    const id = randomUUID();
    await http().put(`${base}/paps/${id}`).set('Authorization', token).send({}).expect(200);

    await http().put(`${base}/paps/${id}/photos/activation`).set('Authorization', token).attach('file', jpeg, 'a.jpg').expect(200);
    await http().put(`${base}/paps/${id}/photos/stop`).set('Authorization', token).attach('file', jpeg, 'e.jpg').expect(200);
    await http().put(`${base}/paps/${id}/photos/stop`).set('Authorization', token).attach('file', jpeg, 'e2.jpg').expect(200);
    await http().put(`${base}/paps/${id}/photos/painel`).set('Authorization', token).attach('file', jpeg, 'x.jpg').expect(404);

    const { body } = await http().get(base).set('Authorization', token).expect(200);
    expect(body.paps[0].sections.activation.photo.thumbnailUrl).toBeTruthy();
    expect(body.paps[0].sections.reset.photo).toBeUndefined();
    expect(await ctx.prisma.fileAsset.count()).toBe(2);

    await http().delete(`${base}/paps/${id}/photos/activation`).set('Authorization', token).expect(204);
    expect(await ctx.prisma.fileAsset.count()).toBe(1);

    await http().delete(`${base}/paps/${id}`).set('Authorization', token).expect(204);
    expect(await ctx.prisma.fileAsset.count()).toBe(0);
  });

  it('deve levar os PAP e as fotos ao descartar o rascunho', async () => {
    const { base, token } = await rascunho();
    const id = randomUUID();
    await http().put(`${base}/paps/${id}`).set('Authorization', token).send({ location: 'Painel' }).expect(200);
    await http().put(`${base}/paps/${id}/photos/reset`).set('Authorization', token).attach('file', jpeg, 'r.jpg').expect(200);

    await http().delete(base).set('Authorization', token).expect(204);

    expect(await ctx.prisma.papAssessment.count()).toBe(0);
    expect(await ctx.prisma.fileAsset.count()).toBe(0);
  });

  it('não deve deixar o cliente gravar PAP, nem gravar em análise concluída, nem usar id de outra análise', async () => {
    const { base, token } = await rascunho();
    const id = randomUUID();
    await http().put(`${base}/paps/${id}`).set('Authorization', token).send({}).expect(200);
    await http().put(`${base}/paps/${randomUUID()}`).set('Authorization', await como(elenco.antonio)).send({}).expect(403);
    await http().put(`${base}/paps/pap-1`).set('Authorization', token).send({}).expect(400);

    await http().post(`/companies/${elenco.brf.id}/equipments`).set('Authorization', await como(elenco.josué)).send({ name: 'Torno' }).expect(201);
    const outra = `/companies/${elenco.brf.id}/equipments/eq-0002/analyses`;
    await http().post(outra).set('Authorization', token).expect(201);
    await http().put(`${outra}/1/paps/${id}`).set('Authorization', token).send({}).expect(409);

    await ctx.prisma.analysis.updateMany({ data: { status: 'CONCLUDED', concludedAt: new Date() } });
    await http().put(`${base}/paps/${randomUUID()}`).set('Authorization', token).send({}).expect(409);
  });
});
