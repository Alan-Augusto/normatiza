import { Component, computed, forwardRef, input, signal } from '@angular/core';
import { ControlValueAccessor, FormsModule, NG_VALUE_ACCESSOR } from '@angular/forms';
import { MultiSelect } from 'primeng/multiselect';

import type { StandardSectionDto } from '@normatiza/shared';

import { CampoComponent } from '../../../../../../../../../shared/components/form/campo.component';

/** "Conforme item 12.38.1, as zonas de perigo…" → "as zonas de perigo…": o código já vem ao lado. */
export function textoDoItem(texto: string): string {
  return texto.replace(/^Conforme (o )?item [^,]+,\s*/i, '');
}

/**
 * Os itens da NR-12 descumpridos — no ponto de risco, no PAP e no PE. Busca
 * pelo código ou pelo texto, e mostra abaixo o texto inteiro de cada item
 * escolhido: o código sozinho não diz nada a quem revisa.
 */
@Component({
  selector: 'app-normas-descumpridas',
  standalone: true,
  imports: [FormsModule, MultiSelect, CampoComponent],
  providers: [{ provide: NG_VALUE_ACCESSOR, useExisting: forwardRef(() => NormasDescumpridasComponent), multi: true }],
  template: `
    <app-campo [para]="inputId()" rotulo="Itens da NR-12" ajuda="Busque pelo código ou por uma palavra do texto." [mensagemId]="inputId() + '-ajuda'">
      <p-multiselect
        [inputId]="inputId()"
        data-testid="campo-normas"
        [ngModel]="ids()"
        (ngModelChange)="escolher($event)"
        [disabled]="desabilitado()"
        [options]="grupos()"
        [group]="true"
        optionGroupLabel="label"
        optionGroupChildren="items"
        optionLabel="label"
        optionValue="value"
        [filter]="true"
        filterPlaceholder="12.38 ou intertravamento"
        [virtualScroll]="true"
        [virtualScrollItemSize]="40"
        [maxSelectedLabels]="0"
        selectedItemsLabel="{0} itens escolhidos"
        placeholder="Nenhum item"
        styleClass="w-full"
        appendTo="body"
      />
    </app-campo>
    @if (escolhidas().length) {
      <ul class="normas" data-testid="normas-escolhidas">
        @for (n of escolhidas(); track n.id) {
          <li>
            <span class="codigo">{{ n.itemCode }}</span>&ngsp;<span class="text-sm">{{ n.text }}</span>
          </li>
        }
      </ul>
    }
  `,
  styles: `
    .normas {
      display: flex;
      flex-direction: column;
      gap: 0.5rem;
      margin-top: 0.75rem;
    }
    .normas li {
      display: grid;
      grid-template-columns: 5.5rem 1fr;
      gap: 0.5rem;
      color: var(--p-text-color);
    }
    .codigo {
      font-family: var(--font-mono, ui-monospace, monospace);
      font-size: 0.8125rem;
      font-weight: 600;
      color: var(--p-text-muted-color);
    }
  `,
})
export class NormasDescumpridasComponent implements ControlValueAccessor {
  readonly secoes = input.required<StandardSectionDto[]>();
  readonly inputId = input('normas');

  protected readonly ids = signal<string[]>([]);
  protected readonly desabilitado = signal(false);
  private aoMudar: (ids: string[]) => void = () => undefined;
  private aoTocar: () => void = () => undefined;

  protected readonly grupos = computed(() =>
    this.secoes()
      .filter((s) => s.standards.length)
      .map((s) => ({ label: s.name, items: s.standards.map((i) => ({ label: `${i.itemCode} — ${textoDoItem(i.text)}`, value: i.id })) })),
  );

  private readonly porId = computed(() => {
    const mapa = new Map<string, { itemCode: string; text: string }>();
    for (const s of this.secoes()) for (const i of s.standards) mapa.set(i.id, { itemCode: i.itemCode, text: textoDoItem(i.text) });
    return mapa;
  });

  protected readonly escolhidas = computed(() =>
    this.ids().flatMap((id) => {
      const n = this.porId().get(id);
      return n ? [{ id, ...n }] : [];
    }),
  );

  protected escolher(ids: string[]): void {
    this.ids.set(ids ?? []);
    this.aoMudar(this.ids());
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
