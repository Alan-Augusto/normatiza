import type { StandardSectionDto } from '@normatiza/shared';

import type { GrupoDeEscolha } from '../../../../../../../../../shared/components/escolha-multipla/escolha';

/** "Conforme item 12.38.1, as zonas de perigo…" → "as zonas de perigo…": o código já vem ao lado. */
export function textoDoItem(texto: string): string {
  return texto.replace(/^Conforme (o )?item [^,]+,\s*/i, '');
}

/** As seções da norma como grupos de escolha: o código em destaque, o texto inteiro. */
export function gruposDeNorma(secoes: readonly StandardSectionDto[]): GrupoDeEscolha[] {
  return secoes
    .filter((s) => s.standards.length)
    .map((s) => ({ titulo: s.name, itens: s.standards.map((i) => ({ id: i.id, codigo: i.itemCode, texto: textoDoItem(i.text) })) }));
}
