import { Injectable, inject, computed } from '@angular/core';
import { NavigationEnd, Router } from '@angular/router';
import { filter } from 'rxjs/operators';
import { toSignal } from '@angular/core/rxjs-interop';
import { ActiveContextService } from './active-context.service';

export interface MenuItem {
  label: string;
  icon: string;
  route: string;
}

export interface BreadcrumbItem {
  label: string;
  route?: string;
}

/** Os contextos de navegação definidos em docs/produto/03 — Navegação e Telas. */
export type ContextLevel = 'admin' | 'consultancy' | 'company' | 'equipment' | 'execution';

export interface MenuContext {
  level: ContextLevel;
  backLink?: { label: string; route: string };
  items: MenuItem[];
  breadcrumbs: BreadcrumbItem[];
}

/**
 * Monta o menu lateral e as migalhas do contexto ativo.
 *
 * O menu é a âncora que delimita em qual universo o usuário está atuando
 * (Contexto 0 a 3 + Área de Execução). Título e subtítulo da tela **não** vêm
 * daqui — vêm do `data` da rota, via `PageMetaService`.
 */
@Injectable({ providedIn: 'root' })
export class MenuContextService {
  private readonly router = inject(Router);
  private readonly activeContext = inject(ActiveContextService);

  private readonly currentUrl = toSignal(
    this.router.events.pipe(
      filter((event): event is NavigationEnd => event instanceof NavigationEnd)
    ),
    { initialValue: new NavigationEnd(0, this.router.url, this.router.url) }
  );

  public readonly context = computed<MenuContext>(() => {
    const rawUrl = this.currentUrl()?.urlAfterRedirects || this.currentUrl()?.url || '';
    const url = rawUrl.split('?')[0].split('#')[0];

    // ÁREA DE EXECUÇÃO — transversal
    if (url.startsWith('/app/my-tasks')) {
      return {
        level: 'execution' as const,
        items: [{ label: 'Minhas Tarefas', icon: 'pi pi-check-square', route: '/app/my-tasks' }],
        breadcrumbs: [{ label: 'Minhas Tarefas' }]
      };
    }

    // CONTEXTO 3 — Equipamento
    const equipmentMatch = url.match(/\/app\/companies\/([^\/]+)\/equipments\/([^\/]+)/);
    if (equipmentMatch) {
      const companyId = equipmentMatch[1];
      const equipmentId = equipmentMatch[2];
      const base = `/app/companies/${companyId}/equipments/${equipmentId}`;

      const items: MenuItem[] = [
        { label: 'Dashboard', icon: 'pi pi-gauge', route: `${base}/dashboard` },
        { label: 'Análises de Risco', icon: 'pi pi-shield', route: `${base}/analysis` },
        { label: 'Histórico', icon: 'pi pi-history', route: `${base}/history` }
      ];

      const companyName = this.activeContext.company()?.name ?? `Empresa ${companyId}`;
      const equipmentName = this.activeContext.equipment()?.name ?? `Equipamento ${equipmentId}`;

      const breadcrumbs: BreadcrumbItem[] = [
        { label: 'Empresas', route: '/app/companies' },
        { label: companyName, route: `/app/companies/${companyId}/dashboard` },
        { label: equipmentName, route: `${base}/dashboard` }
      ];

      const activeItem = items.find(i => url.startsWith(i.route));
      if (activeItem && activeItem.label !== 'Dashboard') {
        breadcrumbs.push({ label: activeItem.label });
      }

      return {
        level: 'equipment' as const,
        backLink: { label: 'Voltar para Equipamentos', route: `/app/companies/${companyId}/equipments` },
        items,
        breadcrumbs
      };
    }

    // CONTEXTO 2 — Empresa
    const companyMatch = url.match(/\/app\/companies\/([^\/]+)/);
    if (companyMatch) {
      const companyId = companyMatch[1];
      const base = `/app/companies/${companyId}`;

      const items: MenuItem[] = [
        { label: 'Dashboard', icon: 'pi pi-chart-pie', route: `${base}/dashboard` },
        { label: 'Equipamentos', icon: 'pi pi-box', route: `${base}/equipments` },
        { label: 'Plano de Ação', icon: 'pi pi-list-check', route: `${base}/action-plan` }
      ];

      const companyName = this.activeContext.company()?.name ?? `Empresa ${companyId}`;
      const breadcrumbs: BreadcrumbItem[] = [
        { label: 'Empresas', route: '/app/companies' },
        { label: companyName, route: `${base}/dashboard` }
      ];

      const activeItem = items.find(i => url.startsWith(i.route));
      if (activeItem && activeItem.label !== 'Dashboard') {
        breadcrumbs.push({ label: activeItem.label });
      }

      return {
        level: 'company' as const,
        backLink: { label: 'Voltar para Empresas', route: '/app/companies' },
        items,
        breadcrumbs
      };
    }

    // CONTEXTO 0 — Admin do Sistema
    if (url.startsWith('/admin')) {
      const items: MenuItem[] = [
        { label: 'Contas', icon: 'pi pi-users', route: '/admin/accounts' },
        { label: 'Compras', icon: 'pi pi-shopping-cart', route: '/admin/purchases' },
        { label: 'Design System', icon: 'pi pi-palette', route: '/admin/design-system' }
      ];

      const activeItem = items.find(i => url.startsWith(i.route));
      return {
        level: 'admin' as const,
        items,
        breadcrumbs: [{ label: activeItem?.label ?? 'Administração' }]
      };
    }

    // CONTEXTO 1 — Consultoria (Visão Geral)
    const items: MenuItem[] = [
      { label: 'Dashboard', icon: 'pi pi-chart-pie', route: '/app/dashboard' },
      { label: 'Empresas', icon: 'pi pi-building', route: '/app/companies' },
      { label: 'Meus Cadastros', icon: 'pi pi-book', route: '/app/catalogs/solutions' }
    ];

    const activeItem = items.find(i => url.startsWith(i.route));
    return {
      level: 'consultancy' as const,
      items,
      breadcrumbs: [{ label: activeItem?.label ?? 'Visão Geral' }]
    };
  });
}
