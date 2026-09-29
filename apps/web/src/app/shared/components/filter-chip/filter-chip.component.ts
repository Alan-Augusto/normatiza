import { ChangeDetectionStrategy, Component, input, output } from '@angular/core';
import { NgIcon, provideIcons } from '@ng-icons/core';
import { lucideX } from '@ng-icons/lucide';

/**
 * Pílula minimalista de filtro ativo na toolbar da tabela.
 *
 * Exibe o rótulo do filtro e um botão 'x' para remoção rápida.
 */
@Component({
  selector: 'app-filter-chip',
  standalone: true,
  imports: [NgIcon],
  providers: [provideIcons({ lucideX })],
  templateUrl: './filter-chip.component.html',
  styleUrl: './filter-chip.component.css',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class FilterChip {
  readonly label = input.required<string>();
  readonly remover = output<void>();
}
