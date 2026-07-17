import { Component, CUSTOM_ELEMENTS_SCHEMA } from '@angular/core';
import { NgIconComponent, provideIcons } from '@ng-icons/core';
import { lucideFolderX, lucideRefreshCw, lucideEyeOff } from '@ng-icons/lucide';


@Component({
  selector: 'app-landing-problem',
  standalone: true,
  imports: [NgIconComponent],
  providers: [provideIcons({ lucideFolderX, lucideRefreshCw, lucideEyeOff })],
  schemas: [CUSTOM_ELEMENTS_SCHEMA],
  templateUrl: './landing-problem.component.html',
  styleUrl: './landing-problem.component.scss',
})
export class LandingProblemComponent {
  readonly problems = [
    {
      icon: 'lucideFolderX',
      iconBg: 'bg-red-50',
      iconColor: 'text-red-500',
      hoverBorder: 'hover:border-red-100',
      hoverShadow: 'hover:shadow-red-500/5',
      title: 'Planilhas e pastas soltas',
      description: 'Análises espalhadas em Excel, Google Drive e e-mails. Sem histórico centralizado e com zero rastreabilidade.',
      delay: 'delay-100',
    },
    {
      icon: 'lucideRefreshCw',
      iconBg: 'bg-orange-50',
      iconColor: 'text-orange-500',
      hoverBorder: 'hover:border-orange-100',
      hoverShadow: 'hover:shadow-orange-500/5',
      title: 'Retrabalho constante',
      description: 'Cada análise parece começar do zero. Sem templates base, sem padronização entre analistas e com perda de tempo.',
      delay: 'delay-200',
    },
    {
      icon: 'lucideEyeOff',
      iconBg: 'bg-slate-200',
      iconColor: 'text-slate-600',
      hoverBorder: 'hover:border-slate-200',
      hoverShadow: 'hover:shadow-slate-500/5',
      title: 'Zero visibilidade',
      description: 'Não sabe quantas análises sua equipe entregou no mês, nem o volume de risco da carteira de clientes.',
      delay: 'delay-300',
    },
  ];
}
