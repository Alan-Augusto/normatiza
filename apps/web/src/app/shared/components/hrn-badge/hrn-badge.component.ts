import { DecimalPipe } from '@angular/common';
import { ChangeDetectionStrategy, Component, computed, input } from '@angular/core';

import { HRN_TABLE_LEGACY, type RiskLevel } from '@normatiza/shared';

const RÓTULO = Object.fromEntries(HRN_TABLE_LEGACY.levels.map((f) => [f.level, f.label])) as Record<RiskLevel, string>;

/**
 * O único jeito de mostrar um HRN (docs/web/design_system.md §5): o número e a
 * faixa, na cor que o laudo usa. Sem HRN, "—" — nunca um zero inventado.
 *
 * A cor nunca fala sozinha: o nome da faixa vai escrito ao lado, para quem não
 * distingue as cores e para a impressão em preto e branco.
 */
@Component({
  selector: 'app-hrn-badge',
  standalone: true,
  imports: [DecimalPipe],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    @if (nivel(); as n) {
      <span class="selo" [attr.data-level]="n" data-testid="hrn">
        <!-- &ngsp;: o espaço entre número e faixa, que o leitor de tela precisa e o compilador apagaria. -->
        <span class="valor tabular-nums">{{ resultado() | number: '1.0-2' }}</span>&ngsp;<span>{{ rotulo() }}</span>
      </span>
    } @else {
      <span class="text-muted-color" data-testid="hrn">—</span>
    }
  `,
  styles: `
    .selo {
      display: inline-flex;
      align-items: center;
      gap: 0.375rem;
      white-space: nowrap;
      border-radius: 9999px;
      padding: 0.125rem 0.5rem;
      font-size: var(--text-xs);
      font-weight: 600;
    }
    .valor {
      font-weight: 700;
    }
    [data-level='ACCEPTABLE'] { background: var(--color-risk-acceptable); color: var(--color-risk-acceptable-contrast); }
    [data-level='VERY_LOW'] { background: var(--color-risk-very-low); color: var(--color-risk-very-low-contrast); }
    [data-level='LOW'] { background: var(--color-risk-low); color: var(--color-risk-low-contrast); }
    [data-level='SIGNIFICANT'] { background: var(--color-risk-significant); color: var(--color-risk-significant-contrast); }
    [data-level='HIGH'] { background: var(--color-risk-high); color: var(--color-risk-high-contrast); }
    [data-level='VERY_HIGH'] { background: var(--color-risk-very-high); color: var(--color-risk-very-high-contrast); }
    [data-level='EXTREME'] { background: var(--color-risk-extreme); color: var(--color-risk-extreme-contrast); }
    [data-level='UNACCEPTABLE'] { background: var(--color-risk-unacceptable); color: var(--color-risk-unacceptable-contrast); }
  `,
})
export class HrnBadgeComponent {
  readonly resultado = input<number | undefined>(undefined);
  readonly nivel = input<RiskLevel | undefined>(undefined);

  readonly rotulo = computed(() => {
    const n = this.nivel();
    return n ? RÓTULO[n] : '';
  });
}
