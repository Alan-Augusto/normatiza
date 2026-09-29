import {
  Component,
  ElementRef,
  HostListener,
  computed,
  inject,
  input,
  output,
  signal,
} from '@angular/core';
import { CommonModule } from '@angular/common';
import { NgIcon, provideIcons } from '@ng-icons/core';
import {
  lucideSlidersHorizontal,
  lucideChevronRight,
  lucideChevronLeft,
  lucideCheck,
  lucideX,
} from '@ng-icons/lucide';
import { TooltipModule } from 'primeng/tooltip';

export interface FilterOption<T = unknown> {
  label: string;
  value: T;
  count?: number;
  dotColor?: string;
}

export interface FilterGroup<T = unknown> {
  id: string;
  label: string;
  options: FilterOption<T>[];
  selectedValue?: T | null;
  /**
   * Tipo visual do seletor de opção:
   * - 'radio': seleção única (padrão)
   * - 'checkbox': seleção múltipla
   */
  tipo?: 'radio' | 'checkbox';
}

/**
 * Menu de Filtros Multinível com Submenus.
 *
 * Estilo Linear / shadcn: botão minimalista 28×28px no cabeçalho da tabela que
 * abre um menu popover suspenso. Passar o mouse ou clicar em uma categoria abre
 * um submenu lateral fluido com radio buttons (seleção única) ou checkboxes, tags de cores e contadores.
 */
@Component({
  selector: 'app-filter-menu',
  standalone: true,
  imports: [CommonModule, NgIcon, TooltipModule],
  providers: [
    provideIcons({
      lucideSlidersHorizontal,
      lucideChevronRight,
      lucideChevronLeft,
      lucideCheck,
      lucideX,
    }),
  ],
  templateUrl: './filter-menu.component.html',
  styleUrl: './filter-menu.component.css',
})
export class FilterMenuComponent {
  private readonly elementRef = inject(ElementRef);

  readonly groups = input.required<FilterGroup[]>();
  readonly label = input<string>('Filtros');

  readonly change = output<{ groupId: string; value: unknown | null }>();
  readonly clearAll = output<void>();

  readonly menuAberto = signal(false);
  readonly submenuAberto = signal<string | null>(null);

  /** Total de filtros ativos em todos os grupos. */
  readonly totalAtivos = computed(() => {
    let count = 0;
    for (const group of this.groups()) {
      if (group.selectedValue !== undefined && group.selectedValue !== null && group.selectedValue !== '') {
        count++;
      }
    }
    return count;
  });

  alternarMenu(): void {
    const novoEstado = !this.menuAberto();
    this.menuAberto.set(novoEstado);
    if (!novoEstado) {
      this.submenuAberto.set(null);
    }
  }

  fechar(): void {
    this.menuAberto.set(false);
    this.submenuAberto.set(null);
  }

  abrirSubmenu(groupId: string): void {
    this.menuAberto.set(true);
    this.submenuAberto.set(groupId);
  }

  alternarSubmenu(groupId: string): void {
    this.menuAberto.set(true);
    if (this.submenuAberto() === groupId) {
      this.submenuAberto.set(null);
    } else {
      this.submenuAberto.set(groupId);
    }
  }

  temAtivoNoGrupo(group: FilterGroup): boolean {
    return group.selectedValue !== undefined && group.selectedValue !== null && group.selectedValue !== '';
  }

  rotuloAtivoNoGrupo(group: FilterGroup): string | null {
    if (!this.temAtivoNoGrupo(group)) return null;
    const opt = group.options.find((o) => o.value === group.selectedValue);
    return opt ? opt.label : null;
  }

  estaSelecionado(group: FilterGroup, opt: FilterOption): boolean {
    return group.selectedValue === opt.value;
  }

  selecionarOpcao(groupId: string, opt: FilterOption): void {
    const group = this.groups().find((g) => g.id === groupId);
    const jaSelecionado = group?.selectedValue === opt.value;
    const novoValor = jaSelecionado ? null : opt.value;

    this.change.emit({ groupId, value: novoValor });
  }

  limparGrupo(groupId: string): void {
    this.change.emit({ groupId, value: null });
  }

  limparTudo(): void {
    this.clearAll.emit();
    for (const group of this.groups()) {
      if (this.temAtivoNoGrupo(group)) {
        this.change.emit({ groupId: group.id, value: null });
      }
    }
    this.fechar();
  }

  @HostListener('document:click', ['$event'])
  aoClicarFora(event: MouseEvent): void {
    if (!this.menuAberto()) return;
    const clicouDentro = this.elementRef.nativeElement.contains(event.target);
    if (!clicouDentro) {
      this.fechar();
    }
  }

  @HostListener('window:keydown.escape')
  aoPressionarEsc(): void {
    this.fechar();
  }
}
