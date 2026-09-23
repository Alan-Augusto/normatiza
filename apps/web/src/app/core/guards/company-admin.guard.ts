import { inject } from '@angular/core';
import { CanActivateFn, Router } from '@angular/router';

import { COMPANY_ADMIN_ROLES } from '@normatiza/shared';

import { AuthService } from '../auth/auth.service';
import { rotaDeEntrada } from '../auth/entry-route';

/**
 * Quem administra o cadastro de empresas: Engenheiro Responsável e Engenheiro
 * da Consultoria — e o **titular da conta**, mesmo sem vínculo nenhum. Numa
 * conta recém-aberta ele ainda não tem empresa, e é ele quem cadastra a
 * primeira (docs/produto/01 §5). Por isso não é um `roleGuard`: papel mora no
 * vínculo, e o titular sem vínculo não tem papel para mostrar.
 *
 * Na edição, a guarda pergunta se a pessoa administra **alguma** empresa; se
 * administra **esta**, quem responde é o servidor — e a tela mostra a recusa.
 */
export const companyAdminGuard: CanActivateFn = (_route, state) => {
  const auth = inject(AuthService);
  const router = inject(Router);

  if (!auth.isAuthenticated()) {
    return router.createUrlTree(['/login'], { queryParams: { returnUrl: state.url } });
  }

  if (auth.isAccountOwner() || auth.hasRole(COMPANY_ADMIN_ROLES)) return true;

  return router.parseUrl(rotaDeEntrada(auth.session()!));
};
