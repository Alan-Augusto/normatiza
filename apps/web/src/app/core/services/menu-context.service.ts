import { Injectable, inject, computed } from '@angular/core';
import { NavigationEnd, Router } from '@angular/router';
import { filter } from 'rxjs/operators';
import { toSignal } from '@angular/core/rxjs-interop';
import { ActiveContextService } from './active-context.service';
import { AuthService } from '../auth/auth.service';
import { CONTEXTO_1, rotaDaConsultoria, rotaDeEntrada } from '../auth/entry-route';

export interface MenuItem {
  label: string;
  icon: string;
  route: string;
}

export interface BreadcrumbItem {
  label: string;
  route?: string;
}

/**
 * As telas de configuração — transversais a todos os contextos. Crescem com o
 * produto (notificações, segurança, plano), e é por isso que são um contexto
 * próprio e não um item solto em cada menu.
 */
const CONFIGURAÇÕES = ['/app/profile', '/app/billing'];

/** Os contextos de navegação definidos em docs/produto/03 — Navegação e Telas. */
export type ContextLevel =
  | 'admin'
  | 'consultancy'
  | 'company'
  | 'equipment'
  | 'execution'
  | 'settings';

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
  private readonly auth = inject(AuthService);

  /**
   * Só o lado consultoria tem uma camada acima da empresa.
   *
   * O cliente **nasce dentro do Contexto 2 e nunca sai dele** (03 §1): oferecer
   * a ele "Voltar para Empresas" revelaria que a consultoria atende outras — e
   * o link ainda por cima aponta para uma rota que a guarda dele recusa.
   */
  private readonly temCarteira = computed(() => this.auth.hasRole(CONTEXTO_1));

  private readonly currentUrl = toSignal(
    this.router.events.pipe(
      filter((event): event is NavigationEnd => event instanceof NavigationEnd)
    ),
    { initialValue: new NavigationEnd(0, this.router.url, this.router.url) }
  );

  public readonly context = computed<MenuContext>(() => {
    const rawUrl = this.currentUrl()?.urlAfterRedirects || this.currentUrl()?.url || '';
    return this.montarPara(rawUrl.split('?')[0].split('#')[0]);
  });

  private montarPara(url: string): MenuContext {

    // CONFIGURAÇÕES — transversal, e por isso com contexto **próprio**.
    //
    // Transversal não é ausência de contexto: uma tela que não declara em que
    // universo está herda o padrão, e o padrão era o Contexto 1. Era assim que
    // o perfil mostrava Empresas e Documentos ao lado cliente.
    if (CONFIGURAÇÕES.some((rota) => url.startsWith(rota))) {
      const items: MenuItem[] = [
        { label: 'Meu Perfil', icon: 'pi pi-user', route: '/app/profile' }
      ];

      // Faturamento é do titular da conta — quem responde por ela. Ver
      // `account-owner.guard.ts` para por que não se pergunta pelo papel.
      if (this.auth.isAccountOwner()) {
        items.push({ label: 'Plano / Créditos', icon: 'pi pi-star', route: '/app/billing' });
      }
      const activeItem = items.find((i) => url.startsWith(i.route));

      return {
        level: 'settings' as const,
        backLink: this.voltaParaOContexto(),
        items,
        breadcrumbs: [{ label: 'Configurações' }, { label: activeItem?.label ?? 'Meu Perfil' }]
      };
    }

    // ÁREA DE EXECUÇÃO — transversal
    if (url.startsWith('/app/execution')) {
      return {
        level: 'execution' as const,
        items: [{ label: 'Minhas Tarefas', icon: 'pi pi-check-square', route: '/app/execution' }],
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
        { label: 'Dashboard', icon: 'pi pi-chart-pie', route: `${base}/dashboard` },
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
        { label: 'Planos de Ação', icon: 'pi pi-list-check', route: `${base}/action-plan` },
        { label: 'Equipe', icon: 'pi pi-users', route: `${base}/team` }
      ];

      const companyName = this.activeContext.company()?.name ?? `Empresa ${companyId}`;
      const breadcrumbs: BreadcrumbItem[] = this.temCarteira()
        ? [
            { label: 'Empresas', route: '/app/companies' },
            { label: companyName, route: `${base}/dashboard` }
          ]
        : [{ label: companyName, route: `${base}/dashboard` }];

      const activeItem = items.find(i => url.startsWith(i.route));
      if (activeItem && activeItem.label !== 'Dashboard') {
        breadcrumbs.push({ label: activeItem.label });
      }

      return {
        level: 'company' as const,
        backLink: this.temCarteira()
          ? { label: 'Voltar para Empresas', route: '/app/companies' }
          : undefined,
        items,
        breadcrumbs
      };
    }

    // CONTEXTO 0 — Admin do Sistema
    if (url.startsWith('/admin')) {
      const items: MenuItem[] = [
        { label: 'Contas', icon: 'pi pi-users', route: '/admin/accounts' },
        { label: 'Admins da Plataforma', icon: 'pi pi-shield', route: '/admin/admins' },
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
    //
    // **Só para quem tem carteira.** Este era o `else` de tudo que o serviço não
    // reconhecia, e por isso qualquer rota nova virava uma chance de mostrar ao
    // cliente um universo que não é dele. Quem não é da consultoria cai no
    // próprio contexto.
    if (!this.temCarteira()) return this.contextoDeQuemNãoTemCarteira();

    const items: MenuItem[] = [
      { label: 'Dashboard', icon: 'pi pi-chart-pie', route: '/app/dashboard' },
      { label: 'Empresas', icon: 'pi pi-building', route: '/app/companies' },
      { label: 'Equipe', icon: 'pi pi-users', route: '/app/team' },
      { label: 'Documentos', icon: 'pi pi-book', route: '/app/catalogs/solutions' }
    ];

    const activeItem = items.find(i => url.startsWith(i.route));
    return {
      level: 'consultancy' as const,
      items,
      breadcrumbs: [{ label: activeItem?.label ?? 'Visão Geral' }]
    };
  }

  /** A saída das configurações: de volta ao universo de onde a pessoa veio. */
  private voltaParaOContexto(): { label: string; route: string } {
    const sessão = this.auth.session();
    if (!sessão) return { label: 'Voltar', route: '/app' };

    const route = rotaDeEntrada(sessão);
    const label = route.startsWith('/admin')
      ? 'Voltar para a Plataforma'
      : route === '/app/dashboard'
        ? 'Voltar para a Consultoria'
        : route === '/app/execution'
          ? 'Voltar para Minhas Tarefas'
          : 'Voltar para a Empresa';

    return { label, route };
  }

  /**
   * A rede de segurança para URL desconhecida: em vez do menu privilegiado,
   * monta o contexto da própria pessoa, a partir da porta de entrada dela.
   *
   * Não há risco de laço — `rotaDaConsultoria` sempre devolve uma rota que este
   * serviço reconhece.
   */
  private contextoDeQuemNãoTemCarteira(): MenuContext {
    const sessão = this.auth.session();
    const destino = sessão ? rotaDaConsultoria(sessão) : '/app/profile';

    return this.montarPara(destino);
  }
}
