import { Component, inject, input, signal, computed, HostListener } from '@angular/core';
import { Router, NavigationEnd, RouterLink, RouterLinkActive } from '@angular/router';
import { toSignal } from '@angular/core/rxjs-interop';
import { filter, map } from 'rxjs/operators';
import { NgIconComponent, provideIcons } from '@ng-icons/core';
import { lucideSidebarClose, lucideSidebarOpen } from '@ng-icons/lucide';
import { Tooltip } from 'primeng/tooltip';
import { ThemeService } from '../../services/theme.service';
import { MenuContextService } from '../../../core/services/menu-context';
import { MenuModule } from 'primeng/menu';
import { MenuItem } from 'primeng/api';

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

  title = input<string>('Normatiza');
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

  // State provided by MenuContextService
  protected readonly context = this.menuContext.context;
  protected readonly menuItems = computed(() => this.context().items);
  protected readonly activePageTitle = computed(() => this.context().title);
  protected readonly activePageSubtitle = computed(() => this.context().subtitle);
  protected readonly contextBackLink = computed(() => this.context().backLink);
  protected readonly breadcrumbs = computed(() => this.context().breadcrumbs);

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
          command: () => this.router.navigate(['/auth/login']) // Fallback for now
        }
      ]
    }
  ];

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
