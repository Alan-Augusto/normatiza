import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';

import {
  calculateHrn,
  HRN_TABLE_LEGACY,
  HrnFactors,
  requiresAction,
  RiskLevel,
  safetyCategory,
} from '@normatiza/shared';

/**
 * O HRN precisa dar, em todo laudo migrado, o mesmo número e a mesma faixa que
 * o legado deu (docs/produto/00 §6). O oráculo aqui é a regra do laudo do
 * legado (`AnalysisReport.getHrnMenssage`, em `decimal` do C#), reescrita em
 * inteiros exatos — e não a implementação.
 */

const PESOS = {
  fe: ['0.5', '1', '1.5', '2.5', '4', '5'],
  pe: ['0.03', '1', '1.5', '2', '5', '8', '10', '15'],
  mpl: ['0.1', '0.5', '2', '4', '6', '10', '15'],
  np: ['1', '2', '4', '8', '12'],
};

/** "0.03" → 3n: centésimos exatos, sem passar por ponto flutuante. */
const centesimos = (texto: string): bigint => {
  const [inteira, fração = ''] = texto.split('.');
  return BigInt(inteira) * 100n + BigInt(fração.padEnd(2, '0'));
};

/** A cascata do laudo do legado, em centésimos⁴ (escala 10⁸). */
function faixaDoLaudoLegado(produto: bigint): RiskLevel {
  const x = (n: number) => BigInt(n) * 100_000_000n;
  if (produto > x(1) && produto <= x(5)) return 'VERY_LOW';
  if (produto > x(5) && produto <= x(10)) return 'LOW';
  if (produto > x(10) && produto <= x(50)) return 'SIGNIFICANT';
  if (produto > x(50) && produto <= x(100)) return 'HIGH';
  if (produto > x(100) && produto <= x(500)) return 'VERY_HIGH';
  if (produto > x(500) && produto <= x(1000)) return 'EXTREME';
  if (produto > x(1000)) return 'UNACCEPTABLE';
  return 'ACCEPTABLE';
}

function* todasAsCombinações() {
  for (const fe of PESOS.fe)
    for (const pe of PESOS.pe)
      for (const mpl of PESOS.mpl)
        for (const np of PESOS.np) yield { fe, pe, mpl, np };
}

const hrn = (fe: number, pe: number, mpl: number, np: number) => calculateHrn({ fe, pe, mpl, np });

describe('HRN', () => {
  it('deve classificar as 1.680 combinações de pesos exatamente como o laudo do legado', () => {
    let total = 0;
    for (const c of todasAsCombinações()) {
      total++;
      const produto = centesimos(c.fe) * centesimos(c.pe) * centesimos(c.mpl) * centesimos(c.np);
      const fatores: HrnFactors = { fe: Number(c.fe), pe: Number(c.pe), mpl: Number(c.mpl), np: Number(c.np) };

      const calculado = calculateHrn(fatores);

      expect({ c, level: calculado.level }).toEqual({ c, level: faixaDoLaudoLegado(produto) });
      expect(calculado.result).toBe(Number(produto) / 100_000_000);
    }
    expect(total).toBe(1680);
  });

  it('deve ter nas opções da tabela exatamente os pesos do legado', () => {
    for (const fator of ['fe', 'pe', 'mpl', 'np'] as const) {
      expect(HRN_TABLE_LEGACY.factors[fator].map((o) => o.weight)).toEqual(PESOS[fator].map(Number));
    }
  });

  it('deve semear no banco, na migração, exatamente a tabela do cálculo compartilhado', () => {
    const sql = readFileSync(
      resolve(__dirname, '../../prisma/migrations/20260929190000_catalogos_da_analise/migration.sql'),
      'utf-8',
    );
    const [, id, label, effectiveFrom, factors, levels] =
      /VALUES\s*\('([^']+)', '([^']+)', '([^']+)', '(.+?)'::jsonb, '(.+?)'::jsonb\);/s.exec(sql) ?? [];

    expect({ id, label, effectiveFrom, factors: JSON.parse(factors), levels: JSON.parse(levels) }).toEqual(HRN_TABLE_LEGACY);
  });

  it('deve classificar 1,08 como Risco Muito Baixo, e não cair num buraco entre as faixas', () => {
    // O único resultado possível entre 1 e 1,1: a tela do legado o chamava de Inaceitável.
    const pontoDe108 = hrn(1.5, 0.03, 2, 12);

    expect(pontoDe108.result).toBe(1.08);
    expect(pontoDe108.level).toBe('VERY_LOW');
  });

  it('deve incluir o limite na faixa de baixo: 1 é aceitável, 5 é muito baixo, 1.000 é extremo', () => {
    expect(hrn(1, 1, 0.5, 2).level).toBe('ACCEPTABLE');
    expect(hrn(5, 1, 0.5, 2).level).toBe('VERY_LOW');
    expect(hrn(5, 10, 10, 2).level).toBe('EXTREME');
  });

  it('deve dar o valor decimal exato, sem o resto do ponto flutuante', () => {
    // 1.5 * 0.03 * 0.1 em ponto flutuante dá 0.0045000000000000005.
    expect(hrn(1.5, 0.03, 0.1, 1).result).toBe(0.0045);
  });

  it('deve recusar peso que não existe na tabela', () => {
    expect(() => hrn(3, 1, 1, 1)).toThrow(/Peso 3 não existe na tabela para FE/);
  });

  it('deve mandar para o plano de ação tudo que está acima do aceitável', () => {
    expect(requiresAction('ACCEPTABLE')).toBe(false);
    expect(requiresAction('VERY_LOW')).toBe(true);
  });
});

describe('categoria NBR 14153', () => {
  it('deve dar categoria 1 para ferimento leve, qualquer que seja o resto', () => {
    expect(safetyCategory({ severity: 1, frequency: 2, possibility: 2 })).toEqual({ severity: 1, category: 1 });
  });

  it('deve seguir o gráfico de risco do legado para ferimento sério', () => {
    expect(safetyCategory({ severity: 2, frequency: 1, possibility: 1 }).category).toBe(2);
    expect(safetyCategory({ severity: 2, frequency: 1, possibility: 2 }).category).toBe(3);
    expect(safetyCategory({ severity: 2, frequency: 2, possibility: 1 }).category).toBe(3);
    expect(safetyCategory({ severity: 2, frequency: 2, possibility: 2 }).category).toBe(4);
  });

  it('deve exigir frequência e possibilidade quando o ferimento é sério', () => {
    expect(() => safetyCategory({ severity: 2, frequency: 1 })).toThrow(/obrigatórias/);
  });
});
