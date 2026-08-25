import { Injectable, inject, computed } from '@angular/core';
import { NavigationEnd, Router } from '@angular/router';
import { toSignal } from '@angular/core/rxjs-interop';
import { filter } from 'rxjs/operators';

export interface PageMeta {
  label: string;
  subtitle: string;
  icon?: string;
}

/**
 * Resolve título e subtítulo da tela ativa a partir do `data` da rota
 * (`label` / `subtitle` / `icon`), conforme docs/web/arquitetura.md §5.2.
 *
 * Nenhuma tela declara seu próprio `<h1>`: o layout renderiza a partir daqui.
 */
@Injectable({ providedIn: 'root' })
export class PageMetaService {
  private readonly router = inject(Router);

  private readonly navigation = toSignal(
    this.router.events.pipe(filter((event): event is NavigationEnd => event instanceof NavigationEnd)),
    { initialValue: null }
  );

  readonly meta = computed<PageMeta>(() => {
    this.navigation();

    const meta: PageMeta = { label: '', subtitle: '' };
    let route = this.router.routerState.snapshot.root;

    while (route) {
      const data = route.data as Partial<PageMeta>;
      if (data?.label) meta.label = data.label;
      if (data?.subtitle) meta.subtitle = data.subtitle;
      if (data?.icon) meta.icon = data.icon;
      route = route.firstChild as typeof route;
    }

    return meta;
  });
}
