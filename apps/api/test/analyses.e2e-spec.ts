import { randomUUID } from 'node:crypto';

import * as request from 'supertest';

import { TokenService } from '../src/auth/token.service';
import { importarCatalogosDoLegado } from '../src/catalogs/legacy-catalog-import';
import { sharp } from '../src/storage/sharp';
import { Elenco, montarElenco } from './helpers/elenco';
import { TestApp, createTestApp } from './helpers/test-app';

/**
 * A análise de risco, primeira parte: abrir o rascunho e a ficha técnica
 * (docs/produto/03 §5.2, docs/planos/analise-de-risco.md).
 */
describe('Análise de risco (e2e)', () => {
  let ctx: TestApp;
  let tokens: TokenService;
  let elenco: Elenco;
  let jpeg: Buffer;

  beforeAll(async () => {
    ctx = await createTestApp();
    tokens = ctx.app.get(TokenService);
    jpeg = await sharp({ create: { width: 800, height: 600, channels: 3, background: '#555' } }).jpeg().toBuffer();
  });

  afterAll(async () => {
    await ctx.close();
  });

  beforeEach(async () => {
    elenco = await montarElenco(ctx.prisma);
    // O banco de teste é truncado a cada teste, e a tabela HRN vai junto.
    await importarCatalogosDoLegado(ctx.prisma, []);
  });

  const http = () => request(ctx.app.getHttpServer());

  async function como(pessoa: { id: string }) {
    const { accessToken } = await tokens.issuePair({ id: pessoa.id, accountId: elenco.normatiza.id });
    return `Bearer ${accessToken}`;
  }

  /** Uma máquina na BRF, cadastrada pelo Josué. Devolve a base das rotas de análise dela. */
  async function máquina(companyId = elenco.brf.id): Promise<string> {
    const { body } = await http()
      .post(`/companies/${companyId}/equipments`)
      .set('Authorization', await como(elenco.josué))
      .send({ name: 'Prensa hidráulica' })
      .expect(201);
    return `/companies/${companyId}/equipments/${body.code.toLowerCase()}/analyses`;
  }

  describe('abrir', () => {
    it('deve abrir a Análise 1 como rascunho, com quem abriu como técnico de campo', async () => {
      const base = await máquina();

      const { body } = await http().post(base).set('Authorization', await como(elenco.fernando)).expect(201);

      expect(body).toMatchObject({
        number: 1,
        revision: 1,
        status: 'DRAFT',
        norm: 'NR-12',
        hrnTableVersionId: 'hrn-legado-v1',
        fieldTechnician: { id: elenco.fernando.id, name: 'Fernando' },
        actions: { edit: true, discard: true },
      });
      expect(body.sheet.safetyManagement).toEqual({
        maintenancePlannedByQualifiedProfessional: null,
        maintenanceRecorded: null,
        maintenanceRecordsAvailable: null,
        hasInstructionManual: null,
        hasWorkAndSafetyProcedures: null,
        workersTrained: null,
      });
    });

    it('não deve abrir um segundo rascunho na mesma máquina, dizendo qual está aberto', async () => {
      const base = await máquina();
      await http().post(base).set('Authorization', await como(elenco.fernando)).expect(201);

      const { body } = await http().post(base).set('Authorization', await como(elenco.carla)).expect(409);

      expect(body).toMatchObject({ number: 1, message: expect.stringContaining('Análise 1') });
    });

    it('não deve abrir dois rascunhos nem com os dois pedidos chegando juntos', async () => {
      const base = await máquina();
      const [a, b] = [await como(elenco.fernando), await como(elenco.carla)];

      const respostas = await Promise.all([http().post(base).set('Authorization', a), http().post(base).set('Authorization', b)]);

      expect(respostas.map((r) => r.status).sort()).toEqual([201, 409]);
      expect(await ctx.prisma.analysis.count()).toBe(1);
    });

    it('deve devolver a mesma análise quando o aparelho reenvia a criação com o mesmo id', async () => {
      const base = await máquina();
      const token = await como(elenco.fernando);
      const id = randomUUID();

      const primeira = await http().post(base).set('Authorization', token).send({ id }).expect(201);
      const reenvio = await http().post(base).set('Authorization', token).send({ id }).expect(200);

      expect(reenvio.body.id).toBe(id);
      expect(primeira.body.id).toBe(id);
      expect(await ctx.prisma.analysis.count()).toBe(1);
    });

    it('deve deixar só a consultoria abrir análise', async () => {
      const base = await máquina();

      for (const pessoa of [elenco.marcos, elenco.antonio, elenco.débora]) {
        await http().post(base).set('Authorization', await como(pessoa)).expect(403);
      }
      await http().post(base).set('Authorization', await como(elenco.rafael)).expect(404);
    });

    it('não deve abrir análise em equipamento desativado', async () => {
      const base = await máquina();
      const josué = await como(elenco.josué);
      await http().post(`/companies/${elenco.brf.id}/equipments/eq-0001/deactivate`).set('Authorization', josué).expect(204);

      await http().post(base).set('Authorization', josué).expect(409);
    });
  });

  describe('o rascunho é da consultoria', () => {
    it('não deve mostrar o rascunho ao cliente, nem na lista nem pelo endereço', async () => {
      const base = await máquina();
      await http().post(base).set('Authorization', await como(elenco.fernando)).expect(201);

      const marcos = await como(elenco.marcos);
      const lista = await http().get(base).set('Authorization', marcos).expect(200);
      expect(lista.body).toEqual([]);
      await http().get(`${base}/1`).set('Authorization', marcos).expect(404);

      const consultoria = await http().get(base).set('Authorization', await como(elenco.carla)).expect(200);
      expect(consultoria.body.map((a: { number: number }) => a.number)).toEqual([1]);
    });
  });

  describe('etapa 1 — ficha técnica', () => {
    it('deve guardar tempos, regime e as respostas, e limpar o que não vier', async () => {
      const base = await máquina();
      const token = await como(elenco.fernando);
      await http().post(base).set('Authorization', token).expect(201);

      await http()
        .put(`${base}/1/sheet`)
        .set('Authorization', token)
        .send({
          fieldTechnicianUserId: elenco.fernando.id,
          times: { cycleTimeSec: 12.5, emergencyStopTimeSec: 0.8 },
          shiftRegime: '  2 turnos,   16 h/dia ',
          safetyManagement: { hasInstructionManual: true, workersTrained: false },
        })
        .expect(200);
      const { body } = await http()
        .put(`${base}/1/sheet`)
        .set('Authorization', token)
        .send({ fieldTechnicianUserId: elenco.fernando.id, times: { cycleTimeSec: 10 }, safetyManagement: { hasInstructionManual: true } })
        .expect(200);

      expect(body.sheet).toEqual({
        times: { cycleTimeSec: 10 },
        safetyManagement: {
          maintenancePlannedByQualifiedProfessional: null,
          maintenanceRecorded: null,
          maintenanceRecordsAvailable: null,
          hasInstructionManual: true,
          hasWorkAndSafetyProcedures: null,
          workersTrained: null,
        },
      });
    });

    it('deve aparar o regime de uso', async () => {
      const base = await máquina();
      const token = await como(elenco.fernando);
      await http().post(base).set('Authorization', token).expect(201);

      const { body } = await http()
        .put(`${base}/1/sheet`)
        .set('Authorization', token)
        .send({ fieldTechnicianUserId: elenco.fernando.id, shiftRegime: '  2 turnos,   16 h/dia ' })
        .expect(200);

      expect(body.sheet.shiftRegime).toBe('2 turnos, 16 h/dia');
    });

    it('deve trocar o técnico de campo por outra pessoa da consultoria da empresa', async () => {
      const base = await máquina();
      const token = await como(elenco.josué);
      await http().post(base).set('Authorization', token).expect(201);

      const { body } = await http().put(`${base}/1/sheet`).set('Authorization', token).send({ fieldTechnicianUserId: elenco.fernando.id }).expect(200);

      expect(body.fieldTechnician).toEqual({ id: elenco.fernando.id, name: 'Fernando' });
    });

    it('deve recusar como técnico quem é do cliente, ou da consultoria mas não desta empresa', async () => {
      const brf = await máquina();
      const seara = await máquina(elenco.seara.id);
      const josué = await como(elenco.josué);
      await http().post(brf).set('Authorization', josué).expect(201);
      await http().post(seara).set('Authorization', josué).expect(201);

      const cliente = await http().put(`${brf}/1/sheet`).set('Authorization', josué).send({ fieldTechnicianUserId: elenco.marcos.id }).expect(400);
      expect(cliente.body.field).toBe('fieldTechnicianUserId');
      // O Fernando é técnico só da BRF.
      await http().put(`${seara}/1/sheet`).set('Authorization', josué).send({ fieldTechnicianUserId: elenco.fernando.id }).expect(400);
    });

    it('deve oferecer como técnico de campo a consultoria alocada na empresa, e só ela', async () => {
      const brf = await máquina();
      const seara = await máquina(elenco.seara.id);
      const josué = await como(elenco.josué);

      const naBrf = await http().get(`${brf}/field-technicians`).set('Authorization', josué).expect(200);
      const naSeara = await http().get(`${seara}/field-technicians`).set('Authorization', josué).expect(200);

      expect(naBrf.body.map((p: { name: string }) => p.name)).toEqual(['Carla', 'Fernando', 'Josué']);
      expect(naSeara.body.map((p: { name: string }) => p.name)).toEqual(['Carla', 'Josué']);
      await http().get(`${brf}/field-technicians`).set('Authorization', await como(elenco.marcos)).expect(403);
    });

    it('deve recusar tempo negativo e resposta que não é sim nem não', async () => {
      const base = await máquina();
      const token = await como(elenco.fernando);
      await http().post(base).set('Authorization', token).expect(201);

      await http().put(`${base}/1/sheet`).set('Authorization', token).send({ times: { cycleTimeSec: -1 } }).expect(400);
      await http().put(`${base}/1/sheet`).set('Authorization', token).send({ safetyManagement: { workersTrained: 'talvez' } }).expect(400);
    });

    it('não deve deixar o cliente alterar a análise', async () => {
      const base = await máquina();
      await http().post(base).set('Authorization', await como(elenco.fernando)).expect(201);

      await http().put(`${base}/1/sheet`).set('Authorization', await como(elenco.antonio)).send({}).expect(403);
    });
  });

  describe('fotos de reconhecimento', () => {
    it('deve guardar a vista, com miniatura, e apagar a anterior ao trocar', async () => {
      const base = await máquina();
      const token = await como(elenco.fernando);
      await http().post(base).set('Authorization', token).expect(201);

      await http().put(`${base}/1/photos/front`).set('Authorization', token).attach('file', jpeg, 'frente.jpg').expect(200);
      const segunda = await http().put(`${base}/1/photos/front`).set('Authorization', token).attach('file', jpeg, 'frente2.jpg').expect(200);

      expect(segunda.body.url).toBeTruthy();
      expect(segunda.body.thumbnailUrl).toBeTruthy();
      const arquivos = await ctx.prisma.fileAsset.findMany({ where: { analysisId: { not: null } } });
      expect(arquivos.map((a) => a.category)).toEqual(['ANALYSIS_PHOTO_FRONT']);
      const { body } = await http().get(`${base}/1`).set('Authorization', token).expect(200);
      expect(Object.keys(body.photos)).toEqual(['front']);
    });

    it('deve remover a vista', async () => {
      const base = await máquina();
      const token = await como(elenco.fernando);
      await http().post(base).set('Authorization', token).expect(201);
      await http().put(`${base}/1/photos/rear`).set('Authorization', token).attach('file', jpeg, 'tras.jpg').expect(200);

      await http().delete(`${base}/1/photos/rear`).set('Authorization', token).expect(204);

      const { body } = await http().get(`${base}/1`).set('Authorization', token).expect(200);
      expect(body.photos).toEqual({});
      expect(await ctx.prisma.fileAsset.count()).toBe(0);
    });

    it('deve recusar vista que não existe', async () => {
      const base = await máquina();
      const token = await como(elenco.fernando);
      await http().post(base).set('Authorization', token).expect(201);

      await http().put(`${base}/1/photos/top`).set('Authorization', token).attach('file', jpeg, 'cima.jpg').expect(404);
    });
  });

  describe('descartar', () => {
    it('deve apagar o rascunho e as fotos, e liberar o número para a próxima', async () => {
      const base = await máquina();
      const token = await como(elenco.fernando);
      await http().post(base).set('Authorization', token).expect(201);
      await http().put(`${base}/1/photos/front`).set('Authorization', token).attach('file', jpeg, 'frente.jpg').expect(200);

      await http().delete(`${base}/1`).set('Authorization', token).expect(204);

      expect(await ctx.prisma.fileAsset.count()).toBe(0);
      const auditoria = await ctx.prisma.auditLog.findFirst({ where: { action: 'analysis.discarded' } });
      expect(auditoria?.before).toMatchObject({ number: 1 });
      const nova = await http().post(base).set('Authorization', token).expect(201);
      expect(nova.body.number).toBe(1);
    });

    it('não deve descartar análise concluída', async () => {
      const base = await máquina();
      const token = await como(elenco.fernando);
      const { body } = await http().post(base).set('Authorization', token).expect(201);
      await ctx.prisma.analysis.update({ where: { id: body.id }, data: { status: 'CONCLUDED', concludedAt: new Date() } });

      await http().delete(`${base}/1`).set('Authorization', token).expect(409);
    });

    it('deve numerar a próxima depois da maior que existe', async () => {
      const base = await máquina();
      const token = await como(elenco.fernando);
      const { body } = await http().post(base).set('Authorization', token).expect(201);
      await ctx.prisma.analysis.update({ where: { id: body.id }, data: { status: 'CONCLUDED', concludedAt: new Date() } });

      const segunda = await http().post(base).set('Authorization', token).expect(201);

      expect(segunda.body.number).toBe(2);
      const lista = await http().get(base).set('Authorization', await como(elenco.marcos)).expect(200);
      expect(lista.body.map((a: { number: number; status: string }) => [a.number, a.status])).toEqual([[1, 'CONCLUDED']]);
    });
  });

  describe('o equipamento com análise', () => {
    it('não deve ser excluído, nem mostrar a exclusão como possível', async () => {
      const base = await máquina();
      const josué = await como(elenco.josué);
      await http().post(base).set('Authorization', josué).expect(201);

      const detalhe = await http().get(`/companies/${elenco.brf.id}/equipments/eq-0001`).set('Authorization', josué).expect(200);
      expect(detalhe.body.actions.delete).toBe(false);
      await http().delete(`/companies/${elenco.brf.id}/equipments/eq-0001`).set('Authorization', josué).expect(409);
    });
  });
});
