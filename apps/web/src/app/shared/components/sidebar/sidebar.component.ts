import { Component, inject, input, signal, computed, HostListener } from '@angular/core';
import { Router, NavigationEnd, RouterLink, RouterLinkActive } from '@angular/router';
import { toSignal } from '@angular/core/rxjs-interop';
import { filter, map } from 'rxjs/operators';
import { NgIconComponent, provideIcons } from '@ng-icons/core';
import { lucideSidebarClose, lucideSidebarOpen } from '@ng-icons/lucide';
import { Tooltip } from 'primeng/tooltip';
import { ThemeService } from '../../services/theme.service';
import { MenuContextService } from '@core/services/menu-context.service';
import { PageMetaService } from '@core/services/page-meta.service';
import { ActiveContextService } from '@core/services/active-context.service';
import { MenuModule } from 'primeng/menu';
import { MenuItem } from 'primeng/api';
import { ROLE_LABEL } from '@normatiza/shared';
import { AuthService } from '@core/auth/auth.service';

@Component({
  selector: 'app-sidebar',
  standalone: true,
  imports: [RouterLink, RouterLinkActive, NgIconComponent, Tooltip, MenuModule],
  providers: [provideIcons({ lucideSidebarClose, lucideSidebarOpen })],
  templateUrl: './sidebar.component.html',
  styleUrl: './sidebar.component.css'
})
export class SidebarComponent {
  private readonly router = inject(Router);
  private readonly themeService = inject(ThemeService);
  private readonly menuContext = inject(MenuContextService);
  private readonly pageMeta = inject(PageMetaService);
  private readonly activeContext = inject(ActiveContextService);
  private readonly auth = inject(AuthService);

  appTitle = input<string>('Normatiza', { alias: 'appTitle' });
  logoIcon = input<string>('pi pi-box');

  protected readonly isDarkMode = this.themeService.isDarkMode;
  isCollapsed = signal<boolean>(false);

  // Monitor current route changes for general layout links
  private readonly currentUrl = toSignal(
    this.router.events.pipe(
      filter((event): event is NavigationEnd => event instanceof NavigationEnd),
      map((event: NavigationEnd) => event.urlAfterRedirects || event.url)
    ),
    { initialValue: this.router.url }
  );

  protected readonly baseRoute = computed<string>(() => {
    const url = this.currentUrl();
    if (url.startsWith('/admin')) return '/admin';
    return '/app';
  });

  // Menu e migalhas: MenuContextService
  protected readonly context = this.menuContext.context;
  protected readonly menuItems = computed(() => this.context().items);
  protected readonly contextBackLink = computed(() => this.context().backLink);
  protected readonly breadcrumbs = computed(() => this.context().breadcrumbs);

  // Título e subtítulo da tela: `data` da rota ativa (arquitetura.md §5.2)
  protected readonly activePageTitle = computed(() => this.pageMeta.meta().label);
  protected readonly activePageSubtitle = computed(() => this.pageMeta.meta().subtitle);

  // Cabeçalho de contexto: empresa e equipamento em contexto (arquitetura.md §5.3)
  protected readonly contextHeader = computed<string | null>(() => {
    const company = this.activeContext.company();
    if (!company) return null;
    const equipment = this.activeContext.equipment();
    return equipment ? `${company.name} · ${equipment.name}` : company.name;
  });

  // User Menu State
  userMenuItems: MenuItem[] = [
    {
      label: 'Aparência',
      items: [
        { label: 'Tema Claro', icon: 'pi pi-sun', command: () => this.themeService.setDarkMode(false) },
        { label: 'Tema Escuro', icon: 'pi pi-moon', command: () => this.themeService.setDarkMode(true) },
        { label: 'Sistema', icon: 'pi pi-desktop', command: () => this.themeService.setSystemTheme() }
      ]
    },
    {
      label: 'Conta',
      items: [
        { label: 'Meu Perfil', icon: 'pi pi-user', command: () => this.router.navigate(['/app/profile']) },
        { label: 'Plano / Créditos', icon: 'pi pi-star', command: () => this.router.navigate(['/app/billing']) }
      ]
    },
    {
      separator: true
    },
    {
      label: 'Sessão',
      items: [
        {
          label: 'Sair',
          icon: 'pi pi-power-off',
          command: () => this.sair()
        }
      ]
    }
  ];

  // Identidade de quem está usando o sistema
  protected readonly identidade = computed(() => this.auth.session()?.user ?? null);

  protected readonly iniciais = computed(() => {
    const nome = this.identidade()?.name?.trim();
    if (!nome) return '—';
    const partes = nome.split(/\s+/);
    const primeira = partes[0] ?? '';
    const última = partes.length > 1 ? (partes[partes.length - 1] ?? '') : '';
    return `${primeira.charAt(0)}${última.charAt(0)}`.toUpperCase();
  });

  /**
   * O papel exibido é o do vínculo em contexto quando há uma empresa aberta —
   * a mesma pessoa pode ser Gestor numa empresa e Executor noutra, e mostrar um
   * papel fixo seria mostrar o papel errado em metade das telas.
   */
  protected readonly papelExibido = computed(() => {
    const vínculos = (this.auth.session()?.memberships ?? []).filter((v) => v.isActive);
    if (vínculos.length === 0) return '';

    const empresa = this.activeContext.company();
    const escolhido = vínculos.find((v) => v.companyId === empresa?.id) ?? vínculos[0];
    return escolhido.roles.map((papel) => ROLE_LABEL[papel]).join(' · ');
  });

  private sair(): void {
    // A navegação é a mesma nos dois desfechos: a sessão local já foi descartada
    // pelo `AuthService`, e continuar na tela do app seria mostrar dados de
    // alguém que acabou de sair.
    const irParaOLogin = () => void this.router.navigate(['/login']);
    this.auth.logout().subscribe({ next: irParaOLogin, error: irParaOLogin });
  }

  // Search State
  isSearchOpen = signal<boolean>(false);

  toggleTheme() {
    this.themeService.toggleTheme();
  }

  toggleCollapse() {
    this.isCollapsed.set(!this.isCollapsed());
  }

  toggleSearch() {
    this.isSearchOpen.set(!this.isSearchOpen());
  }

  closeSearch() {
    this.isSearchOpen.set(false);
  }

  @HostListener('window:keydown', ['$event'])
  handleKeyboardEvent(event: KeyboardEvent) {
    if ((event.ctrlKey || event.metaKey) && event.key === 'k') {
      event.preventDefault();
      this.toggleSearch();
    }
    if (event.key === 'Escape' && this.isSearchOpen()) {
      this.closeSearch();
    }
  }
}
