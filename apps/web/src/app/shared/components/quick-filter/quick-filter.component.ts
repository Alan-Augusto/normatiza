import { ChangeDetectionStrategy, Component, input, output } from '@angular/core';
import { NgIcon, provideIcons } from '@ng-icons/core';
import {
  lucideAlertTriangle,
  lucideBell,
  lucideCheckCircle2,
  lucideCircleDot,
  lucideClock,
  lucideFlame,
  lucideHammer,
  lucidePowerOff,
  lucideStar,
  lucideUserCheck,
} from '@ng-icons/lucide';
import { TooltipModule } from 'primeng/tooltip';

export type QuickFilterSeverity = 'primary' | 'warning' | 'danger' | 'info' | 'success';

const QUICK_FILTER_ICONS = {
  lucideAlertTriangle,
  lucideBell,
  lucideCheckCircle2,
  lucideCircleDot,
  lucideClock,
  lucideFlame,
  lucideHammer,
  lucidePowerOff,
  lucideStar,
  lucideUserCheck,
};

/**
 * Botão de filtro rápido (estilo Linear / Certidões).
 *
 * Renderiza um botão quadrado compacto de 28x28px com ícone Lucide,
 * tooltip descritivo e micro-badge opcional com a contagem de itens.
 */
@Component({
  selector: 'app-quick-filter',
  standalone: true,
  imports: [NgIcon, TooltipModule],
  providers: [provideIcons(QUICK_FILTER_ICONS)],
  templateUrl: './quick-filter.component.html',
  styleUrl: './quick-filter.component.css',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class QuickFilter {
  readonly icon = input.required<string>();
  readonly label = input.required<string>();
  readonly badge = input<number | undefined>(undefined);
  readonly ativo = input(false);
  readonly severity = input<QuickFilterSeverity>('primary');

  readonly acionar = output<void>();
}
