import { AbstractControl, ValidationErrors } from '@angular/forms';

/**
 * O mesmo mínimo que a API exige. Repetido aqui para dar retorno imediato a
 * quem digita — a validação que vale continua sendo a do servidor.
 */
export const SENHA_MÍNIMA = 8;

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
