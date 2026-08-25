import { Routes } from '@angular/router';
import { authGuard } from './core/guards/auth.guard';
import { adminGuard } from './core/guards/admin.guard';

/**
 * As rotas espelham os contextos de navegação de docs/produto/03 — Navegação e Telas.
 * Todo `data.label` / `data.subtitle` alimenta o título da tela renderizado pelo
 * layout (docs/web/arquitetura.md §5.2) — telas não declaram cabeçalho próprio.
 */
export const routes: Routes = [
  // ÁREA PÚBLICA
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

  // ÁREA AUTENTICADA — Contexto 1 (Consultoria) e contextos aninhados nele
  {
    path: 'app',
    canActivate: [authGuard],
    loadComponent: () => import('./features/app/app.layout').then(m => m.AppLayoutComponent),
    children: [
      { path: '', redirectTo: 'dashboard', pathMatch: 'full' },
      {
        path: 'dashboard',
        loadComponent: () => import('./features/app/dashboard/dashboard.component').then(m => m.DashboardComponent),
        data: {
          label: 'Dashboard Geral',
          icon: 'pi pi-chart-pie',
          subtitle: 'Central de controle da operação: filas de trabalho, grau de adequação e distribuição de risco.'
        }
      },
      {
        path: 'companies',
        loadComponent: () => import('./features/app/companies/companies.component').then(m => m.CompaniesComponent),
        data: {
          label: 'Empresas',
          icon: 'pi pi-building',
          subtitle: 'Carteira de empresas atendidas. Abrir uma empresa muda o contexto de navegação.'
        }
      },
      {
        path: 'catalogs/solutions',
        loadComponent: () => import('./features/app/catalogs/solutions/solutions.component').then(m => m.SolutionsComponent),
        data: {
          label: 'Soluções',
          icon: 'pi pi-book',
          subtitle: 'Catálogo de soluções técnicas reaproveitáveis nas análises da consultoria.'
        }
      },

      // CONTEXTO 2 — EMPRESA
      {
        path: 'companies/:companyId',
        loadComponent: () => import('./features/app/companies/company/company.layout').then(m => m.CompanyLayoutComponent),
        children: [
          { path: '', redirectTo: 'dashboard', pathMatch: 'full' },
          {
            path: 'dashboard',
            loadComponent: () => import('./features/app/companies/company/dashboard/dashboard.component').then(m => m.CompanyDashboardComponent),
            data: {
              label: 'Dashboard da Empresa',
              icon: 'pi pi-chart-pie',
              subtitle: 'Situação de segurança da planta: adequação, risco por setor e funil do plano de ação.'
            }
          },
          {
            path: 'equipments',
            loadComponent: () => import('./features/app/companies/company/equipments/equipments.component').then(m => m.EquipmentsComponent),
            data: {
              label: 'Equipamentos',
              icon: 'pi pi-box',
              subtitle: 'Inventário da planta. Abrir um equipamento muda o contexto de navegação.'
            }
          },
          {
            path: 'action-plan',
            loadComponent: () => import('./features/app/companies/company/action-plan/action-plan.component').then(m => m.CompanyActionPlanComponent),
            data: {
              label: 'Plano de Ação',
              icon: 'pi pi-list-check',
              subtitle: 'Todos os pontos de todos os equipamentos, nas sete etapas do ciclo de adequação.'
            }
          },

          // CONTEXTO 3 — EQUIPAMENTO
          {
            path: 'equipments/:equipmentId',
            loadComponent: () => import('./features/app/companies/company/equipments/equipment/equipment.layout').then(m => m.EquipmentLayoutComponent),
            children: [
              { path: '', redirectTo: 'dashboard', pathMatch: 'full' },
              {
                path: 'dashboard',
                loadComponent: () => import('./features/app/companies/company/equipments/equipment/dashboard/dashboard.component').then(m => m.EquipmentDashboardComponent),
                data: {
                  label: 'Dashboard do Equipamento',
                  icon: 'pi pi-gauge',
                  subtitle: 'Radiografia da máquina: ficha, selo de conformidade e progresso da adequação.'
                }
              },
              {
                path: 'analysis',
                loadComponent: () => import('./features/app/companies/company/equipments/equipment/analysis/analysis.component').then(m => m.EquipmentAnalysisComponent),
                data: {
                  label: 'Análises de Risco',
                  icon: 'pi pi-shield',
                  subtitle: 'Histórico de análises da máquina. Análise concluída é congelada e versionada.'
                }
              },
              {
                path: 'history',
                loadComponent: () => import('./features/app/companies/company/equipments/equipment/history/history.component').then(m => m.EquipmentHistoryComponent),
                data: {
                  label: 'Histórico do Equipamento',
                  icon: 'pi pi-history',
                  subtitle: 'Linha do tempo do ativo, alimentada automaticamente e nunca sobrescrita.'
                }
              }
            ]
          }
        ]
      },

      // UTILITÁRIOS TRANSVERSAIS
      {
        path: 'profile',
        loadComponent: () => import('./features/app/profile/profile.component').then(m => m.ProfileComponent),
        data: {
          label: 'Meu Perfil',
          icon: 'pi pi-user',
          subtitle: 'Dados da conta, registro profissional e preferências de acesso.'
        }
      }
    ]
  },

  // CONTEXTO 0 — ADMIN DO SISTEMA
  {
    path: 'admin',
    canActivate: [authGuard, adminGuard],
    loadComponent: () => import('./features/admin/admin.layout').then(m => m.AdminLayoutComponent),
    children: [
      { path: '', redirectTo: 'accounts', pathMatch: 'full' },
      {
        path: 'accounts',
        loadComponent: () => import('./features/admin/accounts/accounts.component').then(m => m.AccountsComponent),
        data: {
          label: 'Contas',
          icon: 'pi pi-users',
          subtitle: 'Consultorias com acesso à plataforma, com plano e status de cada uma.'
        }
      },
      {
        path: 'purchases',
        loadComponent: () => import('./features/admin/purchases/purchases.component').then(m => m.PurchasesComponent),
        data: {
          label: 'Compras',
          icon: 'pi pi-shopping-cart',
          subtitle: 'Assinaturas e créditos contratados pelas contas.'
        }
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

  { path: '**', redirectTo: '' }
];
