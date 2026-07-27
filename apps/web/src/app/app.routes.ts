import { Routes } from '@angular/router';
import { authGuard } from './core/guards/auth.guard';
import { adminGuard } from './core/guards/admin.guard';

export const routes: Routes = [
  // 1. ROTAS PÚBLICAS
  {
    path: '',
    loadComponent: () => import('./features/public/public.layout').then(m => m.PublicLayoutComponent),
    children: [
      {
        path: '',
        loadComponent: () => import('./features/public/landing/landing.component').then(m => m.LandingComponent)
      },
      {
        path: 'login',
        loadComponent: () => import('./features/public/auth/auth.component').then(m => m.AuthComponent)
      },
      {
        path: 'pricing',
        loadComponent: () => import('./features/public/pricing/pricing.component').then(m => m.PricingComponent)
      },
      {
        path: 'presentation',
        loadComponent: () => import('./features/public/presentation/presentation.component').then(m => m.PresentationComponent)
      },
      {
        path: 'presentation/print',
        loadComponent: () => import('./features/public/presentation/presentation.component').then(m => m.PresentationComponent),
        data: { isPrint: true }
      }
    ]
  },

  // 2. ROTAS DO APP AUTENTICADO (/app/...)
  {
    path: 'app',
    canActivate: [authGuard],
    loadComponent: () => import('./features/app/app.layout').then(m => m.AppLayoutComponent),
    children: [
      {
        path: '',
        redirectTo: 'dashboard',
        pathMatch: 'full'
      },
      // Nível 1: Global
      {
        path: 'dashboard',
        loadComponent: () => import('./features/app/dashboard/dashboard').then(m => m.Dashboard)
      },
      {
        path: 'clients',
        loadComponent: () => import('./features/app/clients/clients-list/clients-list').then(m => m.ClientsList)
      },
      {
        path: 'solutions',
        loadComponent: () => import('./features/app/solutions/solutions').then(m => m.Solutions)
      },
      // Nível 2: Contexto da Empresa (Client)
      {
        path: 'clients/:clientId',
        loadComponent: () => import('./features/app/clients/client-detail/layout/layout').then(m => m.Layout),
        children: [
          { path: '', redirectTo: 'dashboard', pathMatch: 'full' },
          { path: 'dashboard', loadComponent: () => import('./features/app/clients/client-detail/dashboard/dashboard').then(m => m.Dashboard) },
          { path: 'equipments', loadComponent: () => import('./features/app/clients/client-detail/equipments/equipments-list/equipments-list').then(m => m.EquipmentsList) },
          { path: 'kanban', loadComponent: () => import('./features/app/clients/client-detail/kanban/kanban').then(m => m.Kanban) },
          
          // Nível 3: Contexto do Equipamento
          {
            path: 'equipments/:equipmentId',
            loadComponent: () => import('./features/app/clients/client-detail/equipments/equipment-detail/layout/layout').then(m => m.Layout),
            children: [
              { path: '', redirectTo: 'record', pathMatch: 'full' },
              { path: 'record', loadComponent: () => import('./features/app/clients/client-detail/equipments/equipment-detail/record/record').then(m => m.Record) },
              { path: 'history', loadComponent: () => import('./features/app/clients/client-detail/equipments/equipment-detail/history/history').then(m => m.History) },
              { path: 'inspection', loadComponent: () => import('./features/app/clients/client-detail/equipments/equipment-detail/inspection/inspection').then(m => m.Inspection) },
            ]
          }
        ]
      },
      // Utilitários globais do App
      {
        path: 'profile',
        loadComponent: () => import('./features/app/profile/profile.component').then(m => m.ProfileComponent)
      }
    ]
  },

  // 3. ROTAS ADMINISTRATIVAS (/admin/...)
  {
    path: 'admin',
    canActivate: [authGuard, adminGuard],
    loadComponent: () => import('./features/admin/admin.layout').then(m => m.AdminLayoutComponent),
    children: [
      {
        path: '',
        redirectTo: 'accounts',
        pathMatch: 'full'
      },
      {
        path: 'accounts',
        loadComponent: () => import('./features/admin/accounts/accounts.component').then(m => m.AccountsComponent),
        data: { label: 'Contas', icon: 'pi pi-users' }
      },
      {
        path: 'purchases',
        loadComponent: () => import('./features/admin/purchases/purchases.component').then(m => m.PurchasesComponent),
        data: { label: 'Compras', icon: 'pi pi-shopping-cart' }
      },
      {
        path: 'design-system',
        loadComponent: () => import('./features/admin/design-system/design-system.component').then(m => m.DesignSystemComponent),
        data: { 
          label: 'Design System', 
          icon: 'pi pi-palette', 
          subtitle: 'Biblioteca viva de componentes, cores e padrões visuais sincronizados do Normatiza v2.' 
        }
      }
    ]
  },

  // Rota de fallback
  {
    path: '**',
    redirectTo: ''
  }
];
