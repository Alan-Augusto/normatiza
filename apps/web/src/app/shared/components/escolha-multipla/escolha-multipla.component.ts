import { ChangeDetectionStrategy, Component, computed, forwardRef, inject, input, signal } from '@angular/core';
import { ControlValueAccessor, NG_VALUE_ACCESSOR } from '@angular/forms';
import { NgIconComponent, provideIcons } from '@ng-icons/core';
import { lucideX } from '@ng-icons/lucide';
import { ButtonDirective, ButtonIcon, ButtonLabel } from 'primeng/button';

import { ModalService } from '@core/modal/modal.service';

import type { GrupoDeEscolha, ItemDeEscolha } from './escolha';
import { SeletorDeItensComponent } from './seletor-de-itens.component';

/**
 * Escolha múltipla num catálogo de textos longos — normas, origens,
 * consequências, proteções (docs/web/design_system.md §10). O campo mostra o que
 * foi escolhido, por inteiro, e o botão abre o modal com a lista: um select de
 * uma linha cortava o texto que pede atenção para ser marcado.
 */
@Component({
  selector: 'app-escolha-multipla',
  standalone: true,
  imports: [ButtonDirective, ButtonIcon, ButtonLabel, NgIconComponent],
  providers: [
    provideIcons({ lucideX }),
    { provide: NG_VALUE_ACCESSOR, useExisting: forwardRef(() => EscolhaMultiplaComponent), multi: true },
  ],
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: './escolha-multipla.component.html',
  styleUrl: './escolha-multipla.component.css',
})
export class EscolhaMultiplaComponent implements ControlValueAccessor {
  private readonly modal = inject(ModalService);

  readonly grupos = input.required<GrupoDeEscolha[]>();
  /** O título do modal: "Normas descumpridas". */
  readonly titulo = input.required<string>();
  readonly vazio = input('Nenhum escolhido.');
  readonly buscaPlaceholder = input('Buscar');
  readonly testid = input.required<string>();
  readonly inputId = input<string>();
  /** Textos curtos (origens, proteções) cabem em selos; os longos, em lista. */
  readonly compacto = input(false);

  protected readonly ids = signal<string[]>([]);
  protected readonly desabilitado = signal(false);
  private aoMudar: (ids: string[]) => void = () => undefined;
  private aoTocar: () => void = () => undefined;

  private readonly porId = computed(() => {
    const mapa = new Map<string, ItemDeEscolha>();
    for (const g of this.grupos()) for (const i of g.itens) mapa.set(i.id, i);
    return mapa;
  });

  protected readonly escolhidos = computed(() => this.ids().flatMap((id) => this.porId().get(id) ?? []));

  protected async abrir(): Promise<void> {
    const ref = this.modal.abrir<string[]>(SeletorDeItensComponent, {
      titulo: this.titulo(),
      largura: '48rem',
      testid: `modal-${this.testid()}`,
      entradas: { grupos: this.grupos, escolhidos: this.ids(), buscaPlaceholder: this.buscaPlaceholder() },
    });
    const escolhidos = await ref.fechado;
    if (escolhidos) this.mudar(escolhidos);
  }

  protected tirar(id: string): void {
    this.mudar(this.ids().filter((i) => i !== id));
  }

  private mudar(ids: string[]): void {
    this.ids.set(ids);
    this.aoMudar(ids);
    this.aoTocar();
  }

  writeValue(ids: string[] | null | undefined): void {
    this.ids.set(ids ?? []);
  }

  registerOnChange(fn: (ids: string[]) => void): void {
    this.aoMudar = fn;
  }

  registerOnTouched(fn: () => void): void {
    this.aoTocar = fn;
  }

  setDisabledState(desabilitado: boolean): void {
    this.desabilitado.set(desabilitado);
  }
}
