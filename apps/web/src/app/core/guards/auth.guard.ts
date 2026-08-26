import { inject } from '@angular/core';
import { CanActivateFn, Router } from '@angular/router';

import { AuthService } from '../auth/auth.service';

/**
 * Exige sessão.
 *
 * Isto decide **navegação**, não permissão: quem burlar esta guarda com o
 * devtools aberto continua esbarrando no servidor, que valida a mesma regra a
 * cada requisição. O que se ganha aqui é a pessoa certa não ver uma tela vazia
 * sem explicação.
 */
export const authGuard: CanActivateFn = (_route, state) => {
  const auth = inject(AuthService);
  const router = inject(Router);

  if (auth.isAuthenticated()) return true;

  // Quem clicou no link de um equipamento específico precisa cair nele depois
  // de entrar, não num dashboard genérico.
  return router.createUrlTree(['/login'], { queryParams: { returnUrl: state.url } });
};
