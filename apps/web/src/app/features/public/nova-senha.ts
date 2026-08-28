import { AbstractControl, ValidationErrors } from '@angular/forms';

import { SENHA_MINIMA } from '@normatiza/shared';

/**
 * O mesmo mínimo que a API exige — **importado dela**, não copiado.
 *
 * Já foi uma cópia, e as duas se separaram: aqui valia 8, no servidor valia 10,
 * e quem digitava 9 recebia uma recusa que a tela chamava de "convite
 * expirado". A validação que vale continua sendo a do servidor; esta serve só
 * para dar retorno imediato a quem digita.
 */
export const SENHA_MÍNIMA = SENHA_MINIMA;

/**
 * Duas telas definem senha pela primeira vez — aceitar convite e redefinir — e
 * em nenhuma delas a pessoa vê o que digitou. Sem a confirmação, um erro de
 * digitação vira uma conta trancada com um token já gasto.
 */
export function senhasIguais(grupo: AbstractControl): ValidationErrors | null {
  const senha = grupo.get('password')?.value;
  const confirmação = grupo.get('confirmation')?.value;
  return senha === confirmação ? null : { senhasDiferentes: true };
}
