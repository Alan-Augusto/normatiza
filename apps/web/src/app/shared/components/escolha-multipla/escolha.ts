/** Um item que se escolhe: o código, quando houver (12.4.12), e o texto inteiro. */
export interface ItemDeEscolha {
  id: string;
  codigo?: string;
  texto: string;
}

/** Os itens agrupados como o catálogo os agrupa: seção da norma, tipo de perigo. */
export interface GrupoDeEscolha {
  titulo: string;
  itens: ItemDeEscolha[];
}

/** Sem acento e sem caixa: "intertravamento" acha "Intertravamento". */
export function normalizar(texto: string): string {
  return texto.normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase();
}
