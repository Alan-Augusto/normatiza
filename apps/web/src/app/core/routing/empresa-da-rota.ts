import { Signal, computed, inject } from '@angular/core';
import { toSignal } from '@angular/core/rxjs-interop';
import { ActivatedRoute } from '@angular/router';
import type { CompanySummary } from '@normatiza/shared';
import { combineLatest, map } from 'rxjs';

import { AuthService } from '../auth/auth.service';

/** O nome do parâmetro de `empresas/:companySlug` em `app.routes.ts`. */
export const PARAMETRO_DA_EMPRESA = 'companySlug';

/**
 * A empresa em contexto, lida da URL — de qualquer tela abaixo de
 * `empresas/:companySlug`, na profundidade que for.
 *
 * A URL traz o **slug**; as telas precisam do `id`, que é o que a API conhece.
 * A tradução é pela sessão, e é síncrona porque a guarda de rota já garantiu
 * que a empresa está nela: um slug antigo nem chega aqui, é trocado pelo atual
 * antes de a tela abrir.
 *
 * Percorre a rota até a raiz em vez de ler o próprio `paramMap`: a tela de
 * Equipe mora em `equipe`, dois níveis abaixo do parâmetro, e depender da
 * herança de parâmetros do roteador é depender de uma configuração global.
 */
export function empresaDaRota(): Signal<CompanySummary | null> {
  const route = inject(ActivatedRoute);
  const auth = inject(AuthService);

  const slug = toSignal(
    combineLatest(route.pathFromRoot.map((nível) => nível.paramMap)).pipe(
      map((níveis) => níveis.map((p) => p.get(PARAMETRO_DA_EMPRESA)).find(Boolean) ?? null),
    ),
    {
      initialValue:
        route.pathFromRoot.map((nível) => nível.snapshot.paramMap.get(PARAMETRO_DA_EMPRESA)).find(Boolean) ??
        null,
    },
  );

  return computed(() => {
    const atual = slug();
    return atual ? auth.companyBySlug(atual) : null;
  });
}
