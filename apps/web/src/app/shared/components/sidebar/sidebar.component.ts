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
import { rotaDaConsultoria } from '@core/auth/entry-route';

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

  /**
   * O topo do contexto em que a pessoa está — o destino do ícone de início.
   *
   * Dentro de `/app` **não pode ser `/app` fixo**: essa rota redireciona para
   * `/app/dashboard`, guardado pelo Contexto 1, e o lado cliente cairia no laço
   * `/app → dashboard → recusa → /app`, que trava a aba. `rotaDaConsultoria`
   * devolve o topo real de cada um.
   */
  protected readonly baseRoute = computed<string>(() => {
    if (this.currentUrl().startsWith('/admin')) return '/admin';

    const sessão = this.auth.session();
    return sessão ? rotaDaConsultoria(sessão) : '/app';
  });

  /**
   * A travessia entre o backoffice e a consultoria, para quem é as duas coisas.
   *
   * Fica vazio para quem não é admin da plataforma — e também para o admin sem
   * vínculo ativo nenhum quando ele já está no `/admin`: oferecer "voltar para a
   * consultoria" a quem não tem consultoria é oferecer um caminho que só
   * devolveria a pessoa para onde ela já está.
   */
  private readonly blocoDaPlataforma = computed<MenuItem[]>(() => {
    const sessão = this.auth.session();
    if (!sessão?.isPlatformAdmin) return [];

    if (this.baseRoute() !== '/admin') {
      return [
        {
          label: 'Plataforma',
          items: [
            {
              label: 'Acessar Painel Admin',
              icon: 'pi pi-shield',
              command: () => this.router.navigate(['/admin']),
            },
          ],
        },
      ];
    }

    const temVínculoAtivo = sessão.memberships.some((v) => v.isActive);
    if (!temVínculoAtivo) return [];

    return [
      {
        label: 'Plataforma',
        items: [
          {
            label: 'Voltar para a Consultoria',
            icon: 'pi pi-arrow-left',
            command: () => this.router.navigateByUrl(rotaDaConsultoria(sessão)),
          },
        ],
      },
    ];
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

  /**
   * O menu do usuário é computado, e não uma lista fixa, por causa do bloco de
   * plataforma: ele só existe para quem tem a concessão do Contexto 0, e é o que
   * permite ao dono do produto transitar entre o backoffice e a consultoria dele
   * sem trocar de login.
   */
  protected readonly userMenuItems = computed<MenuItem[]>(() => [
    {
      // A porta para o contexto de Configurações. As telas em si vivem lá — aqui
      // ficam só ações rápidas, que se resolvem sem sair de onde a pessoa está.
      items: [
        {
          label: 'Configurações',
          icon: 'pi pi-cog',
          command: () => this.router.navigate(['/app/profile'])
        }
      ]
    },
    {
      label: 'Aparência',
      items: [
        { label: 'Tema Claro', icon: 'pi pi-sun', command: () => this.themeService.setDarkMode(false) },
        { label: 'Tema Escuro', icon: 'pi pi-moon', command: () => this.themeService.setDarkMode(true) },
        { label: 'Sistema', icon: 'pi pi-desktop', command: () => this.themeService.setSystemTheme() }
      ]
    },
    ...this.blocoDaPlataforma(),
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
  ]);

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
