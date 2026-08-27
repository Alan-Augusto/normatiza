import { inject } from '@angular/core';
import { CanActivateFn, Router } from '@angular/router';

import type { Role } from '@normatiza/shared';

import { AuthService } from '../auth/auth.service';
import { rotaDeEntrada } from '../auth/entry-route';

/**
 * Exige um dos papéis informados. Quando a rota traz `companyId`, exige o papel
 * **naquela empresa** — o Gestor da BRF não vira Gestor da Seara por a rota
 * mudar de parâmetro.
 *
 * O destino da recusa é a **porta de entrada da própria pessoa**, e não um
 * `/app` fixo. Não é preferência de UX: `/app` redireciona para
 * `/app/dashboard`, que esta mesma guarda protege — recusar alguém e mandá-lo
 * para lá fecha o ciclo `/app → dashboard → recusa → /app`. O roteador não tem
 * freio para isso, e o laço é síncrono: trava a aba do navegador.
 *
 * `rotaDeEntrada` é segura por construção, porque só devolve destinos cujas
 * guardas aquela pessoa passa.
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
    if (auth.hasRole(roles, companyId)) return true;

    return router.parseUrl(rotaDeEntrada(auth.session()!));
  };
}
