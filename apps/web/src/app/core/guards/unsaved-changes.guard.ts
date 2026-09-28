import { CanDeactivateFn } from '@angular/router';

/** Um formulário que sabe se tem alteração por salvar, e como dizer o que se perderia. */
export interface FormularioComAlteracoes {
  temAlteracoesNaoSalvas(): boolean;
  /** "nesta empresa", "neste equipamento" — o que se perderia, dito na confirmação. */
  readonly sobreOQue: string;
}

/**
 * Sair do formulário com o cadastro pela metade pede confirmação. Perder tudo
 * num clique no menu é o tipo de coisa que faz a pessoa desconfiar do sistema na
 * primeira semana.
 */
export const unsavedChangesGuard: CanDeactivateFn<FormularioComAlteracoes> = (form) =>
  !form.temAlteracoesNaoSalvas() ||
  window.confirm(`Há alterações não salvas ${form.sobreOQue}. Sair mesmo assim?`);
