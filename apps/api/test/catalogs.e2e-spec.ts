import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';

import * as request from 'supertest';
import { HRN_TABLE_LEGACY } from '@normatiza/shared';

import { TokenService } from '../src/auth/token.service';
import {
  ArquivoDeCatalogoInvalido,
  importarCatalogosDoLegado,
  LinhaDoLegado,
  validarArquivo,
} from '../src/catalogs/legacy-catalog-import';
import { montarElenco } from './helpers/elenco';
import { TestApp, createTestApp } from './helpers/test-app';

/**
 * Os catálogos da análise: o importador do legado (docs/migracao §7) e o pacote
 * que o formulário lê (docs/planos/catalogos-da-analise.md D8).
 */
describe('Catálogos da análise (e2e)', () => {
  let ctx: TestApp;

  beforeAll(async () => {
    ctx = await createTestApp();
  });

  afterAll(async () => {
    await ctx.close();
  });

  const http = () => request(ctx.app.getHttpServer());
  const importar = (linhas: Partial<LinhaDoLegado>[]) => importarCatalogosDoLegado(ctx.prisma, validarArquivo(linhas));

  const capítulo = (id: number, nome: string) => ({ tabela: 'standard_title' as const, id, nome });
  const norma = (id: number, pai_id: number, codigo: string, texto = `Conforme item ${codigo}, …`) => ({
    tabela: 'standard' as const,
    id,
    pai_id,
    codigo,
    texto,
  });
  const PEQUENO: Partial<LinhaDoLegado>[] = [
    capítulo(1, '12.1 Princípios Gerais'),
    capítulo(34, 'Anexo VIII - Prensas e similares'),
    capítulo(11, '12.10 Riscos adicionais'),
    norma(100, 1, '12.1.10'),
    norma(101, 1, '12.1.2'),
    norma(200, 34, '1.1'),
    { tabela: 'danger_type', id: 1, nome: 'Perigos Mecânicos' },
    { tabela: 'danger_type', id: 3, nome: 'Perigos Térmicos' },
    { tabela: 'danger_origin', id: 10, pai_id: 1, nome: 'Partes móveis' },
    { tabela: 'danger_consequence', id: 20, pai_id: 3, nome: 'Queimadura' },
    { tabela: 'danger_consequence', id: 21, pai_id: 1, nome: 'Esmagamento' },
    { tabela: 'security_type', id: 1, nome: 'Proteção Fixa' },
    { tabela: 'security', id: 30, pai_id: 1, nome: 'Grade soldada' },
  ];

  describe('importador', () => {
    it('deve criar tudo na primeira vez, com a ligação ao legado de cada registro', async () => {
      const relatorio = await importar(PEQUENO);

      expect(relatorio.tabelas.standard_title.criados).toBe(3);
      expect(relatorio.tabelas.standard.criados).toBe(3);
      expect(relatorio.tabelas.danger_consequence.criados).toBe(2);
      const ref = await ctx.prisma.legacyRef.findUniqueOrThrow({
        where: { entity_legacyId: { entity: 'standard', legacyId: 200 } },
      });
      const item = await ctx.prisma.standard.findUniqueOrThrow({ where: { id: ref.newId }, include: { section: true } });
      expect(item).toMatchObject({ itemCode: '1.1', norm: 'NR-12', section: { name: 'Anexo VIII - Prensas e similares' } });
    });

    it('deve poder rodar de novo sem duplicar nada', async () => {
      await importar(PEQUENO);

      const segunda = await importar(PEQUENO);

      expect(segunda.tabelas.standard).toEqual({ criados: 0, atualizados: 0, iguais: 3, ausentes: [] });
      expect(await ctx.prisma.standard.count()).toBe(3);
      expect(await ctx.prisma.legacyRef.count()).toBe(PEQUENO.length);
    });

    it('deve atualizar o texto que mudou no legado, mantendo o mesmo registro', async () => {
      await importar(PEQUENO);
      const antes = await ctx.prisma.standard.findFirstOrThrow({ where: { itemCode: '12.1.2' } });

      const relatorio = await importar(PEQUENO.map((l) => (l.id === 101 && l.tabela === 'standard' ? { ...l, texto: 'Texto revisado' } : l)));

      expect(relatorio.tabelas.standard.atualizados).toBe(1);
      const depois = await ctx.prisma.standard.findUniqueOrThrow({ where: { id: antes.id } });
      expect(depois.text).toBe('Texto revisado');
    });

    it('deve manter, e listar, o que sumiu do arquivo — pode haver análise apontando para ele', async () => {
      await importar(PEQUENO);

      const relatorio = await importar(PEQUENO.filter((l) => !(l.tabela === 'standard' && l.id === 100)));

      expect(relatorio.tabelas.standard.ausentes).toEqual([100]);
      expect(await ctx.prisma.standard.count()).toBe(3);
    });

    it('deve recusar item com pai que não existe, sem gravar nada do arquivo', async () => {
      const erro = await importar([...PEQUENO, norma(300, 99, '12.99.1')]).catch((e: unknown) => e);

      expect(erro).toBeInstanceOf(ArquivoDeCatalogoInvalido);
      expect((erro as ArquivoDeCatalogoInvalido).problemas).toEqual(['standard:300: o pai standard_title:99 não existe']);
      expect(await ctx.prisma.standardSection.count()).toBe(0);
      expect(await ctx.prisma.legacyRef.count()).toBe(0);
    });

    it('deve carregar o arquivo exportado do legado inteiro', async () => {
      const arquivo = JSON.parse(readFileSync(resolve(__dirname, '../prisma/catalogos/legado.json'), 'utf-8'));

      const relatorio = await importarCatalogosDoLegado(ctx.prisma, validarArquivo(arquivo));

      const criados = Object.fromEntries(Object.entries(relatorio.tabelas).map(([t, r]) => [t, r.criados]));
      expect(criados).toEqual({
        standard_title: 27,
        standard: 857,
        danger_type: 10,
        danger_origin: 82,
        danger_consequence: 68,
        security_type: 9,
        security: 28,
      });
    });
  });

  describe('GET /catalogs/analysis', () => {
    let token: string;

    beforeEach(async () => {
      const elenco = await montarElenco(ctx.prisma);
      const { accessToken } = await ctx.app
        .get(TokenService)
        .issuePair({ id: elenco.fernando.id, accountId: elenco.normatiza.id });
      token = `Bearer ${accessToken}`;
      await importar(PEQUENO);
    });

    it('deve recusar quem não apresentou token', async () => {
      await http().get('/catalogs/analysis').expect(401);
    });

    it('deve entregar os capítulos pela numeração da norma, e os itens pelo código', async () => {
      const { body } = await http().get('/catalogs/analysis').set('Authorization', token).expect(200);

      expect(body.standardSections.map((s: { name: string }) => s.name)).toEqual([
        '12.1 Princípios Gerais',
        '12.10 Riscos adicionais',
        'Anexo VIII - Prensas e similares',
      ]);
      expect(body.standardSections[0].standards.map((s: { itemCode: string }) => s.itemCode)).toEqual(['12.1.2', '12.1.10']);
    });

    it('deve agrupar origens e consequências pelo tipo de perigo, e dispositivos pelo tipo de proteção', async () => {
      const { body } = await http().get('/catalogs/analysis').set('Authorization', token).expect(200);

      expect(body.hazardTypes).toMatchObject([
        { name: 'Perigos Mecânicos', origins: [{ name: 'Partes móveis' }], consequences: [{ name: 'Esmagamento' }] },
        { name: 'Perigos Térmicos', origins: [], consequences: [{ name: 'Queimadura' }] },
      ]);
      expect(body.protectionTypes).toMatchObject([{ name: 'Proteção Fixa', protections: [{ name: 'Grade soldada' }] }]);
    });

    it('deve entregar a tabela HRN vigente idêntica à do cálculo compartilhado', async () => {
      const { body } = await http().get('/catalogs/analysis').set('Authorization', token).expect(200);

      expect(body.hrnTable).toEqual(HRN_TABLE_LEGACY);
    });

    it('deve responder 304 a quem já tem a versão atual, e a versão nova a quem não tem', async () => {
      const primeira = await http().get('/catalogs/analysis').set('Authorization', token).expect(200);
      const etag = primeira.headers.etag;

      await http().get('/catalogs/analysis').set('Authorization', token).set('If-None-Match', etag).expect(304);

      await importar([...PEQUENO, norma(102, 1, '12.1.3')]);
      const nova = await http().get('/catalogs/analysis').set('Authorization', token).set('If-None-Match', etag).expect(200);
      expect(nova.body.version).not.toBe(primeira.body.version);
    });
  });
});
