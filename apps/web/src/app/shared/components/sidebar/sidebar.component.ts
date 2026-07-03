import { Component, inject, input, signal, computed } from '@angular/core';
import { Router, NavigationEnd, RouterLink, RouterLinkActive } from '@angular/router';
import { toSignal } from '@angular/core/rxjs-interop';
import { filter, map } from 'rxjs/operators';
import { NgIconComponent, provideIcons } from '@ng-icons/core';
import { lucideSidebarClose, lucideSidebarOpen } from '@ng-icons/lucide';
import { Tooltip } from 'primeng/tooltip';
import { ThemeService } from '../../services/theme.service';

export interface SidebarMenuItem {
  label: string;
  icon: string;
  route: string;
  subtitle?: string;
}

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

  title = input<string>('Normatiza');
  logoIcon = input<string>('pi pi-box');

  protected readonly isDarkMode = this.themeService.isDarkMode;
  isCollapsed = signal<boolean>(false);

  // Monitor current route changes
  private readonly currentUrl = toSignal(
    this.router.events.pipe(
      filter((event): event is NavigationEnd => event instanceof NavigationEnd),
      map((event: NavigationEnd) => event.urlAfterRedirects || event.url)
    ),
    { initialValue: this.router.url }
  );

  // Determine the base route of the active context ('/app' or '/admin')
  protected readonly baseRoute = computed<string>(() => {
    const url = this.currentUrl();
    if (url.startsWith('/admin')) {
      return '/admin';
    } else if (url.startsWith('/app')) {
      return '/app';
    }
    return '/';
  });

  // Dynamically map menu items based on URL prefix ('/app' or '/admin')
  protected readonly menuItems = computed<SidebarMenuItem[]>(() => {
    const url = this.currentUrl();
    let prefix = '';

    if (url.startsWith('/admin')) {
      prefix = 'admin';
    } else if (url.startsWith('/app')) {
      prefix = 'app';
    } else {
      return [];
    }

    const matchedRoute = this.router.config.find(route => route.path === prefix);
    if (!matchedRoute || !matchedRoute.children) {
      return [];
    }

    return matchedRoute.children
      .filter(child => child.data && child.data['label'])
      .map(child => ({
        label: child.data!['label'] as string,
        icon: child.data!['icon'] as string || 'pi pi-circle',
        route: `/${prefix}/${child.path}`,
        subtitle: child.data!['subtitle'] as string || ''
      }));
  });

  // Calculate active page title for header/breadcrumb
  protected readonly activePageTitle = computed<string>(() => {
    const url = this.currentUrl();
    const items = this.menuItems();
    const active = items.find(item => url === item.route || url.startsWith(item.route + '/'));
    return active ? active.label : 'Dashboard';
  });

  // Calculate active page subtitle dynamically from route metadata
  protected readonly activePageSubtitle = computed<string>(() => {
    const url = this.currentUrl();
    const items = this.menuItems();
    const active = items.find(item => url === item.route || url.startsWith(item.route + '/'));
    return active && active.subtitle ? active.subtitle : `Normatiza v2 • Contexto ${this.title()}`;
  });

  toggleTheme() {
    this.themeService.toggleTheme();
  }

  toggleCollapse() {
    this.isCollapsed.set(!this.isCollapsed());
  }
}
