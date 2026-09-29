import { randomUUID } from 'node:crypto';

import { Prisma, PrismaClient } from '@prisma/client';
import { HRN_TABLE_LEGACY } from '@normatiza/shared';

/**
 * Carrega os catálogos da análise exportados do legado (docs/migracao §7).
 *
 * O arquivo é o de `scripts/legado/exportar-catalogos.sql`: as sete tabelas
 * empilhadas, uma linha por registro. Cada registro é achado pelo
 * `legacy_refs` — existe, atualiza; não existe, cria —, então rodar de novo com
 * uma exportação recente não duplica nada, e é assim que a migração oficial o
 * reaproveita. Nada é apagado: o que sumiu do arquivo pode estar numa análise,
 * e só é listado.
 */

export const TABELAS_DO_LEGADO = [
  'standard_title',
  'standard',
  'danger_type',
  'danger_origin',
  'danger_consequence',
  'security_type',
  'security',
] as const;

export type TabelaDoLegado = (typeof TABELAS_DO_LEGADO)[number];

export interface LinhaDoLegado {
  tabela: TabelaDoLegado;
  id: number;
  pai_id: number | null;
  codigo: string | null;
  nome: string | null;
  texto: string | null;
}

export interface ResultadoDaTabela {
  criados: number;
  atualizados: number;
  iguais: number;
  /** Ids do legado que já tinham vindo e não estão neste arquivo. */
  ausentes: number[];
}

export interface RelatorioDaImportacao {
  tabelas: Record<TabelaDoLegado, ResultadoDaTabela>;
  tabelaHrnCriada: boolean;
}

export class ArquivoDeCatalogoInvalido extends Error {
  constructor(readonly problemas: string[]) {
    super(`Arquivo de catálogos inválido:\n- ${problemas.join('\n- ')}`);
  }
}

/** Quem é pai de quem, e quem precisa de quê. */
const PAI: Partial<Record<TabelaDoLegado, TabelaDoLegado>> = {
  standard: 'standard_title',
  danger_origin: 'danger_type',
  danger_consequence: 'danger_type',
  security: 'security_type',
};

const inteiro = (valor: unknown): number | null => {
  const n = typeof valor === 'string' && valor.trim() !== '' ? Number(valor) : valor;
  return typeof n === 'number' && Number.isInteger(n) ? n : null;
};

const texto = (valor: unknown): string | null =>
  typeof valor === 'string' && valor.trim() !== '' ? valor.trim() : null;

/**
 * Confere o arquivo inteiro antes de gravar qualquer coisa, e junta todos os
 * problemas numa resposta só — consertar um e descobrir o próximo, um por vez,
 * seria rodar o script dez vezes. Ids e números podem vir como texto: é assim
 * que alguns clientes SQL exportam.
 */
export function validarArquivo(bruto: unknown): LinhaDoLegado[] {
  if (!Array.isArray(bruto)) throw new ArquivoDeCatalogoInvalido(['o arquivo não é uma lista de linhas']);

  const problemas: string[] = [];
  const linhas: LinhaDoLegado[] = [];
  const vistos = new Set<string>();

  bruto.forEach((item, i) => {
    const onde = `linha ${i + 1}`;
    const r = (item ?? {}) as Record<string, unknown>;
    const tabela = r.tabela as TabelaDoLegado;
    if (!TABELAS_DO_LEGADO.includes(tabela)) {
      problemas.push(`${onde}: tabela desconhecida "${String(r.tabela)}"`);
      return;
    }
    const id = inteiro(r.id);
    if (id === null) {
      problemas.push(`${onde} (${tabela}): id inválido "${String(r.id)}"`);
      return;
    }
    const chave = `${tabela}:${id}`;
    if (vistos.has(chave)) problemas.push(`${chave}: repetido no arquivo`);
    vistos.add(chave);

    const linha: LinhaDoLegado = {
      tabela,
      id,
      pai_id: inteiro(r.pai_id),
      codigo: texto(r.codigo),
      nome: texto(r.nome),
      texto: texto(r.texto),
    };
    if (PAI[tabela] && linha.pai_id === null) problemas.push(`${chave}: sem pai_id`);
    if (tabela === 'standard') {
      if (!linha.codigo) problemas.push(`${chave}: item de norma sem código`);
      if (!linha.texto) problemas.push(`${chave}: item de norma sem texto`);
    } else if (!linha.nome) {
      problemas.push(`${chave}: sem nome`);
    }
    linhas.push(linha);
  });

  if (problemas.length > 0) throw new ArquivoDeCatalogoInvalido(problemas);
  return linhas;
}

const ROMANOS: Record<string, number> = { I: 1, V: 5, X: 10, L: 50, C: 100 };

function romano(numeral: string): number {
  let total = 0;
  for (let i = 0; i < numeral.length; i++) {
    const atual = ROMANOS[numeral[i]];
    const próximo = ROMANOS[numeral[i + 1]] ?? 0;
    total += atual < próximo ? -atual : atual;
  }
  return total;
}

/**
 * A posição do capítulo: "12.5 …" pela numeração, "Anexo VIII - …" depois de
 * todos os capítulos, pela numeração romana. O que não seguir nenhum dos dois
 * vai para o fim, na ordem do legado.
 */
export function ordemDoCapitulo(nome: string, idNoLegado: number): number {
  const capítulo = /^12\.(\d+)\b/.exec(nome);
  if (capítulo) return Number(capítulo[1]);
  const anexo = /^Anexo\s+([IVXLC]+)\b/i.exec(nome);
  if (anexo) return 1000 + romano(anexo[1].toUpperCase());
  return 100_000 + idNoLegado;
}

type Tx = Prisma.TransactionClient;

/** O mínimo que o importador usa de um model do Prisma. */
interface Destino {
  findMany(args: { where: { id: { in: string[] } } }): Promise<Array<Record<string, unknown> & { id: string }>>;
  createMany(args: { data: Array<Record<string, unknown>> }): Promise<unknown>;
  update(args: { where: { id: string }; data: Record<string, unknown> }): Promise<unknown>;
}

function destino(tx: Tx, tabela: TabelaDoLegado): Destino {
  const porTabela = {
    standard_title: tx.standardSection,
    standard: tx.standard,
    danger_type: tx.hazardType,
    danger_origin: tx.hazardOrigin,
    danger_consequence: tx.hazardConsequence,
    security_type: tx.protectionType,
    security: tx.protection,
  };
  return porTabela[tabela] as unknown as Destino;
}

async function refsDe(tx: Tx, tabela: TabelaDoLegado): Promise<Map<number, string>> {
  const refs = await tx.legacyRef.findMany({ where: { entity: tabela } });
  return new Map(refs.map((r) => [r.legacyId, r.newId]));
}

/** Os dados do registro na v2, a partir da linha do legado e do id novo do pai. */
function dados(linha: LinhaDoLegado, idDoPai: string | null, posição: number): Record<string, unknown> {
  switch (linha.tabela) {
    case 'standard_title':
      return { name: linha.nome, order: ordemDoCapitulo(linha.nome!, linha.id) };
    case 'standard':
      return { sectionId: idDoPai, itemCode: linha.codigo, text: linha.texto };
    case 'danger_type':
    case 'security_type':
      return { name: linha.nome, order: posição };
    case 'danger_origin':
    case 'danger_consequence':
      return { hazardTypeId: idDoPai, name: linha.nome };
    case 'security':
      return { protectionTypeId: idDoPai, name: linha.nome };
  }
}

async function sincronizar(
  tx: Tx,
  tabela: TabelaDoLegado,
  linhas: LinhaDoLegado[],
  problemas: string[],
): Promise<ResultadoDaTabela> {
  const refs = await refsDe(tx, tabela);
  const pai = PAI[tabela];
  const refsDoPai = pai ? await refsDe(tx, pai) : null;
  const alvo = destino(tx, tabela);

  const ordenadas = [...linhas].sort((a, b) => a.id - b.id);
  const existentes = new Map(
    (await alvo.findMany({ where: { id: { in: [...refs.values()] } } })).map((r) => [r.id, r]),
  );

  const novos: Array<Record<string, unknown>> = [];
  const novasRefs: Prisma.LegacyRefCreateManyInput[] = [];
  const resultado: ResultadoDaTabela = { criados: 0, atualizados: 0, iguais: 0, ausentes: [] };

  for (const [posição, linha] of ordenadas.entries()) {
    let idDoPai: string | null = null;
    if (refsDoPai) {
      idDoPai = refsDoPai.get(linha.pai_id!) ?? null;
      if (!idDoPai) {
        problemas.push(`${tabela}:${linha.id}: o pai ${pai}:${linha.pai_id} não existe`);
        continue;
      }
    }
    const novo = dados(linha, idDoPai, posição + 1);
    const idAtual = refs.get(linha.id);
    const atual = idAtual ? existentes.get(idAtual) : undefined;

    if (!atual) {
      const id = randomUUID();
      novos.push({ id, ...novo });
      novasRefs.push({ entity: tabela, legacyId: linha.id, newId: id });
      resultado.criados++;
    } else if (Object.entries(novo).some(([campo, valor]) => atual[campo] !== valor)) {
      await alvo.update({ where: { id: atual.id }, data: novo });
      resultado.atualizados++;
    } else {
      resultado.iguais++;
    }
  }

  if (novos.length > 0) {
    await alvo.createMany({ data: novos });
    await tx.legacyRef.createMany({ data: novasRefs });
  }

  const noArquivo = new Set(linhas.map((l) => l.id));
  resultado.ausentes = [...refs.keys()].filter((id) => !noArquivo.has(id)).sort((a, b) => a - b);
  return resultado;
}

/** Pais antes dos filhos: o filho precisa do id novo do pai. */
const ORDEM_DE_CARGA: TabelaDoLegado[] = [
  'standard_title',
  'danger_type',
  'security_type',
  'standard',
  'danger_origin',
  'danger_consequence',
  'security',
];

export async function importarCatalogosDoLegado(
  prisma: PrismaClient,
  linhas: LinhaDoLegado[],
): Promise<RelatorioDaImportacao> {
  return prisma.$transaction(
    async (tx) => {
      // A tabela HRN nasce na migração, mas um banco truncado (o de teste) a
      // perde; aqui ela só é criada se faltar — versão existente nunca se edita.
      const hrn = await tx.hrnTableVersion.findUnique({ where: { id: HRN_TABLE_LEGACY.id } });
      if (!hrn) {
        await tx.hrnTableVersion.create({
          data: {
            id: HRN_TABLE_LEGACY.id,
            label: HRN_TABLE_LEGACY.label,
            effectiveFrom: new Date(HRN_TABLE_LEGACY.effectiveFrom),
            factors: HRN_TABLE_LEGACY.factors as unknown as Prisma.InputJsonValue,
            levels: HRN_TABLE_LEGACY.levels as unknown as Prisma.InputJsonValue,
          },
        });
      }

      const problemas: string[] = [];
      const tabelas = {} as Record<TabelaDoLegado, ResultadoDaTabela>;
      for (const tabela of ORDEM_DE_CARGA) {
        tabelas[tabela] = await sincronizar(
          tx,
          tabela,
          linhas.filter((l) => l.tabela === tabela),
          problemas,
        );
      }
      // Lançar desfaz a transação inteira: ou o arquivo entra todo, ou nada.
      if (problemas.length > 0) throw new ArquivoDeCatalogoInvalido(problemas);

      return { tabelas, tabelaHrnCriada: !hrn };
    },
    { timeout: 120_000, maxWait: 10_000 },
  );
}
