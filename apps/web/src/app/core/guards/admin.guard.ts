import { inject } from '@angular/core';
import { CanActivateFn, Router } from '@angular/router';

import { AuthService } from '../auth/auth.service';
import { rotaDeEntrada } from '../auth/entry-route';

/**
 * O Contexto 0 é o backoffice da plataforma.
 *
 * Não se pergunta por papel: ser Engenheiro Responsável é ser dono da própria
 * consultoria, não da plataforma. A pergunta é pela dimensão de plataforma, que
 * o servidor devolve na sessão e revalida a cada requisição do Contexto 0.
 */
export const adminGuard: CanActivateFn = (_route, state) => {
  const auth = inject(AuthService);
  const router = inject(Router);

  if (!auth.isAuthenticated()) {
    return router.createUrlTree(['/login'], { queryParams: { returnUrl: state.url } });
  }

  if (auth.isPlatformAdmin()) return true;

  // Pelo mesmo motivo do `roleGuard`: `/app` fixo joga o lado cliente num laço
  // de redirecionamento que trava a aba.
  return router.parseUrl(rotaDeEntrada(auth.session()!));
};
