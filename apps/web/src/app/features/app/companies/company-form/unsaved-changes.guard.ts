import { CanDeactivateFn } from '@angular/router';

import type { CompanyFormComponent } from './company-form.component';

/**
 * Sair do formulário com o cadastro pela metade pede confirmação. São cinco
 * seções: perder tudo num clique no menu é o tipo de coisa que faz a pessoa
 * desconfiar do sistema na primeira semana.
 */
export const unsavedChangesGuard: CanDeactivateFn<CompanyFormComponent> = (form) =>
  !form.temAlteracoesNaoSalvas() ||
  window.confirm('Há alterações não salvas nesta empresa. Sair mesmo assim?');
