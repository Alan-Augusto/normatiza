/**
 * A invariante do escopo de empresa, do lado de quem monta a tela.
 *
 * `MANAGER`, `CLIENT_ENGINEER` e `DIRECTOR` valem em **um** vínculo ativo só —
 * é o que garante que a BRF nunca enxergue a Seara. Quem impõe isso é um índice
 * parcial no Postgres, e é ele quem tem a palavra final.
 *
 * Esta função não é a defesa: é a **antecipação**. Ela existe para que a tela
 * possa dizer, antes do envio, o que aconteceria — em vez de deixar um erro de
 * constraint chegar traduzido a ninguém. Vive aqui, e não dentro de um
 * componente Angular, porque o app de campo terá a mesma tela e não pode chegar
 * a outra conclusão sobre a mesma regra.
 */

import { isCompanyScopedRole, type Role } from '../auth';

/** O mínimo que se precisa saber de um vínculo para responder à pergunta. */
export interface VínculoComPapéis {
  companyId: string;
  roles: readonly Role[];
  isActive: boolean;
}

/**
 * Devolve o vínculo que impede a troca, ou `undefined` quando não há nenhum.
 *
 * Devolve o vínculo inteiro, e não um booleano, porque a tela precisa **nomear
 * a empresa** no aviso: "já é Diretor na Seara" resolve o problema de quem
 * lê; "conflito de papéis" apenas informa que existe um.
 */
export function vínculoEmConflito<T extends VínculoComPapéis>(
  vínculos: readonly T[],
  companyIdAlvo: string,
  papéisEscolhidos: readonly Role[],
): T | undefined {
  if (!papéisEscolhidos.some(isCompanyScopedRole)) return undefined;

  return vínculos.find(
    (vínculo) =>
      vínculo.isActive &&
      vínculo.companyId !== companyIdAlvo &&
      vínculo.roles.some(isCompanyScopedRole),
  );
}
