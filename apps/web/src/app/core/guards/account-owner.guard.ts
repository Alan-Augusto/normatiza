import { inject } from '@angular/core';
import { CanActivateFn, Router } from '@angular/router';

import { AuthService } from '../auth/auth.service';
import { rotaDeEntrada } from '../auth/entry-route';

/**
 * Exige ser o **titular** da conta — quem responde por ela, não quem tem o papel
 * mais graúdo dentro dela.
 *
 * A distinção importa no faturamento: a conta é a unidade de cobrança
 * ([01 §5](../../../../../docs/produto/01_papeis_e_permissoes.md)), e quem
 * contrata é a consultoria através de quem a titulariza. Hoje o titular é sempre
 * o Engenheiro Responsável, mas checar pelo papel amarraria a regra a essa
 * coincidência — e ela deixa de valer no dia em que a transferência de
 * titularidade existir.
 */
export const accountOwnerGuard: CanActivateFn = (_route, state) => {
  const auth = inject(AuthService);
  const router = inject(Router);

  if (!auth.isAuthenticated()) {
    return router.createUrlTree(['/login'], { queryParams: { returnUrl: state.url } });
  }

  if (auth.isAccountOwner()) return true;

  // Como nas demais guardas: destino fixo em `/app` fecharia o laço de
  // redirecionamento que trava a aba.
  return router.parseUrl(rotaDeEntrada(auth.session()!));
};
