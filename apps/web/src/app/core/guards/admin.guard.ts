import { inject } from '@angular/core';
import { CanActivateFn, Router } from '@angular/router';

import { AuthService } from '../auth/auth.service';

/**
 * O Contexto 0 é o backoffice da plataforma. Nem o Engenheiro Responsável entra
 * nele — ele é dono da consultoria dele, não da Normatiza.
 */
export const adminGuard: CanActivateFn = (_route, state) => {
  const auth = inject(AuthService);
  const router = inject(Router);

  if (!auth.isAuthenticated()) {
    return router.createUrlTree(['/login'], { queryParams: { returnUrl: state.url } });
  }

  return auth.hasRole(['SYSTEM_ADMIN']) || router.createUrlTree(['/app']);
};
