import { Component, inject, input, signal, computed } from '@angular/core';
import { Router, NavigationEnd, RouterLink, RouterLinkActive } from '@angular/router';
import { toSignal } from '@angular/core/rxjs-interop';
import { filter, map } from 'rxjs/operators';
import { NgIconComponent, provideIcons } from '@ng-icons/core';
import { lucideSidebarClose, lucideSidebarOpen } from '@ng-icons/lucide';
import { Tooltip } from 'primeng/tooltip';
import { ThemeService } from '../../services/theme.service';
import { MenuContextService } from '../../../core/services/menu-context';

@Component({
  selector: 'app-sidebar',
  standalone: true,
  imports: [RouterLink, RouterLinkActive, NgIconComponent, Tooltip],
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

  toggleTheme() {
    this.themeService.toggleTheme();
  }

  toggleCollapse() {
    this.isCollapsed.set(!this.isCollapsed());
  }
}
