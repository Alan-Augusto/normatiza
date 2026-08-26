import { inject } from '@angular/core';
import { CanActivateFn, Router } from '@angular/router';

import type { Role } from '@normatiza/shared';

import { AuthService } from '../auth/auth.service';

/**
 * Exige um dos papéis informados. Quando a rota traz `companyId`, exige o papel
 * **naquela empresa** — o Gestor da BRF não vira Gestor da Seara por a rota
 * mudar de parâmetro.
 */
export function roleGuard(roles: readonly Role[]): CanActivateFn {
  return (route, state) => {
    const auth = inject(AuthService);
    const router = inject(Router);

    // Quem não entrou não tem "acesso negado" — tem login pendente.
    if (!auth.isAuthenticated()) {
      return router.createUrlTree(['/login'], { queryParams: { returnUrl: state.url } });
    }

    const companyId = route.params['companyId'] as string | undefined;
    return auth.hasRole(roles, companyId) || router.createUrlTree(['/app']);
  };
}
