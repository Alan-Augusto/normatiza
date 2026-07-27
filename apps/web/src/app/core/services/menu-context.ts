import { Injectable, inject, signal, computed } from '@angular/core';
import { NavigationEnd, Router } from '@angular/router';
import { filter } from 'rxjs/operators';
import { toSignal } from '@angular/core/rxjs-interop';

export interface MenuItem {
  label: string;
  icon: string;
  route: string;
}

export interface BreadcrumbItem {
  label: string;
  route?: string;
}

export interface MenuContext {
  level: 1 | 2 | 3;
  title: string;
  subtitle: string;
  backLink?: { label: string; route: string };
  items: MenuItem[];
  breadcrumbs: BreadcrumbItem[];
}

@Injectable({
  providedIn: 'root'
})
export class MenuContextService {
  private router = inject(Router);

  // Extract URL parameters by parsing the URL
  private readonly currentUrl = toSignal(
    this.router.events.pipe(
      filter((event): event is NavigationEnd => event instanceof NavigationEnd)
    ),
    { initialValue: new NavigationEnd(0, this.router.url, this.router.url) }
  );

  public readonly context = computed<MenuContext>(() => {
    // Pegar URL ignorando query params e fragments para não quebrar o regex
    const rawUrl = this.currentUrl()?.urlAfterRedirects || this.currentUrl()?.url || '';
    const url = rawUrl.split('?')[0].split('#')[0];
    
    // NÍVEL 3: Equipamento
    const equipamentoMatch = url.match(/\/app\/clients\/([^\/]+)\/equipments\/([^\/]+)/);
    if (equipamentoMatch) {
      const clienteId = equipamentoMatch[1];
      const equipamentoId = equipamentoMatch[2];
      
      const items: MenuItem[] = [
        { label: 'Prontuário', icon: 'pi pi-id-card', route: `/app/clients/${clienteId}/equipments/${equipamentoId}/record` },
        { label: 'Histórico', icon: 'pi pi-history', route: `/app/clients/${clienteId}/equipments/${equipamentoId}/history` },
        { label: 'Vistoria', icon: 'pi pi-check-square', route: `/app/clients/${clienteId}/equipments/${equipamentoId}/inspection` }
      ];
      
      const activeItem = items.find(i => url.includes(i.route));
      const breadcrumbs: BreadcrumbItem[] = [
        { label: `Empresa ${clienteId}`, route: `/app/clients/${clienteId}/equipments` },
        { label: `Equipamento ${equipamentoId}`, route: `/app/clients/${clienteId}/equipments/${equipamentoId}/record` }
      ];
      
      if (activeItem && activeItem.label !== 'Prontuário') {
        breadcrumbs.push({ label: activeItem.label });
      }

      return {
        level: 3,
        title: `Equipamento ${equipamentoId}`, // Nome real virá da API no futuro
        subtitle: 'Gestão do Ativo',
        backLink: { label: 'Voltar para Empresa', route: `/app/clients/${clienteId}/equipments` },
        items,
        breadcrumbs
      };
    }

    // NÍVEL 2: Empresa (Cliente)
    const clienteMatch = url.match(/\/app\/clients\/([^\/]+)/);
    if (clienteMatch && !url.includes('/equipments/')) {
      const clienteId = clienteMatch[1];
      
      const items: MenuItem[] = [
        { label: 'Dashboard', icon: 'pi pi-chart-pie', route: `/app/clients/${clienteId}/dashboard` },
        { label: 'Equipamentos', icon: 'pi pi-box', route: `/app/clients/${clienteId}/equipments` },
        { label: 'Kanban', icon: 'pi pi-list', route: `/app/clients/${clienteId}/kanban` }
      ];
      
      const activeItem = items.find(i => url.includes(i.route));
      const breadcrumbs: BreadcrumbItem[] = [
        { label: `Empresa ${clienteId}`, route: `/app/clients/${clienteId}/dashboard` }
      ];
      
      if (activeItem) {
        breadcrumbs.push({ label: activeItem.label });
      }

      return {
        level: 2,
        title: `Empresa ${clienteId}`, // Nome real virá da API no futuro
        subtitle: 'Gestão Industrial',
        backLink: { label: 'Voltar para Visão Geral', route: '/app/clients' },
        items,
        breadcrumbs
      };
    }

    // NÍVEL 1: Global (Admin / Master)
    if (url.startsWith('/admin')) {
      const items: MenuItem[] = [
        { label: 'Contas', icon: 'pi pi-users', route: '/admin/accounts' },
        { label: 'Compras', icon: 'pi pi-shopping-cart', route: '/admin/purchases' },
        { label: 'Design System', icon: 'pi pi-palette', route: '/admin/design-system' }
      ];
      
      const activeItem = items.find(i => url.includes(i.route));
      const breadcrumbs: BreadcrumbItem[] = [];
      if (activeItem) {
        breadcrumbs.push({ label: activeItem.label });
      } else {
        breadcrumbs.push({ label: 'Administração' });
      }

      return {
        level: 1,
        title: 'Administração',
        subtitle: 'Sistema Global',
        items,
        breadcrumbs
      };
    }

    // NÍVEL 1: Global (App)
    const items: MenuItem[] = [
      { label: 'Dashboard', icon: 'pi pi-chart-pie', route: '/app/dashboard' },
      { label: 'Empresas', icon: 'pi pi-building', route: '/app/clients' },
      { label: 'Soluções', icon: 'pi pi-book', route: '/app/solutions' }
    ];
    
    const activeItem = items.find(i => url.includes(i.route));
    const breadcrumbs: BreadcrumbItem[] = [];
    if (activeItem) {
      breadcrumbs.push({ label: activeItem.label });
    } else {
      breadcrumbs.push({ label: 'Visão Geral' });
    }

    return {
      level: 1,
      title: 'Visão Geral',
      subtitle: 'Dashboard Global',
      items,
      breadcrumbs
    };
  });
}
