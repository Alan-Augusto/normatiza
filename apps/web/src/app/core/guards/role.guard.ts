import { inject } from '@angular/core';
import { CanActivateFn, Router } from '@angular/router';
import { catchError, map, of } from 'rxjs';

import type { Role } from '@normatiza/shared';

import { AuthService } from '../auth/auth.service';
import { rotaDeEntrada } from '../auth/entry-route';
import { PARAMETRO_DA_EMPRESA } from '../routing/empresa-da-rota';
import { ROTAS } from '../routing/rotas';
import { CompaniesService } from '../services/companies.service';

/**
 * Exige um dos papéis informados. Quando a rota traz uma empresa, exige o papel
 * **naquela empresa** — o Gestor da BRF não vira Gestor da Seara por a rota
 * mudar de parâmetro.
 *
 * A URL nomeia a empresa pelo **slug** (docs/produto/03 §4). O da sessão se
 * resolve na hora. Um que a sessão não conhece pode ser um endereço antigo — um
 * favorito de antes de a empresa ser renomeada —, e aí a API diz qual é o
 * atual: a pessoa chega na mesma tela, com a URL certa. Se a API não conhece a
 * empresa, ou a pessoa não tem o papel nela, é recusa como qualquer outra.
 *
 * O destino da recusa é a **porta de entrada da própria pessoa**, e não um
 * `/app` fixo. Não é preferência de UX: `/app` redireciona para
 * `/app/painel`, que esta mesma guarda protege — recusar alguém e mandá-lo
 * para lá fecha o ciclo `/app → painel → recusa → /app`. O roteador não tem
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
      return router.createUrlTree([ROTAS.entrar], { queryParams: { returnUrl: state.url } });
    }

    const recusa = () => router.parseUrl(rotaDeEntrada(auth.session()!));

    // A empresa pode estar num nível acima: `equipamentos/novo` é filha de
    // `empresas/:companySlug`, e o roteador não herda o parâmetro para ela.
    const slug = (route.pathFromRoot ?? [route])
      .map((nível) => nível.params?.[PARAMETRO_DA_EMPRESA] as string | undefined)
      .find(Boolean);
    if (!slug) return auth.hasRole(roles) || recusa();

    const empresa = auth.companyBySlug(slug);
    if (empresa) return auth.hasRole(roles, empresa.id) || recusa();

    return inject(CompaniesService)
      .resolveSlug(slug)
      .pipe(
        map((resolvida) =>
          // O slug atual precisa estar na sessão: sem isso, redirecionar para
          // ele cairia aqui de novo, e de novo.
          resolvida.slug !== slug &&
          auth.companyBySlug(resolvida.slug) &&
          auth.hasRole(roles, resolvida.id)
            ? router.parseUrl(trocarSlug(state.url, slug, resolvida.slug))
            : recusa(),
        ),
        catchError(() => of(recusa())),
      );
  };
}

/** Troca só o segmento da empresa: a tela e a query string pedidas continuam. */
function trocarSlug(url: string, antigo: string, atual: string): string {
  return url.replace(`${ROTAS.empresas}/${antigo}`, `${ROTAS.empresas}/${atual}`);
}
