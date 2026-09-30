import type { HrnTableVersion } from '@prisma/client';
import type { HrnTable } from '@normatiza/shared';

/** A linha de `hrn_table_versions` no formato do cálculo compartilhado. Fatores e faixas vão gravados como estão. */
export function tabelaHrnDe(linha: HrnTableVersion): HrnTable {
  return {
    id: linha.id,
    label: linha.label,
    effectiveFrom: linha.effectiveFrom.toISOString(),
    factors: linha.factors as unknown as HrnTable['factors'],
    levels: linha.levels as unknown as HrnTable['levels'],
  };
}
