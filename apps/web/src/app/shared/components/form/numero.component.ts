import { ChangeDetectionStrategy, Component, forwardRef, input } from '@angular/core';
import { NG_VALUE_ACCESSOR } from '@angular/forms';
import { InputGroup } from 'primeng/inputgroup';
import { InputGroupAddon } from 'primeng/inputgroupaddon';
import { InputText } from 'primeng/inputtext';

import { CampoNumerico } from './campo-numerico';

/**
 * Número com a unidade **encostada no campo** — `[ 1.200 | mm ]` —, e não no
 * rótulo (docs/web/design_system.md §9). A unidade é lida junto com o número,
 * que é como a pessoa pensa a medida, e o rótulo fica só com o nome.
 *
 * O formulário recebe `number | null`: nada de texto para converter depois.
 */
@Component({
  selector: 'app-numero',
  standalone: true,
  imports: [InputGroup, InputGroupAddon, InputText],
  changeDetection: ChangeDetectionStrategy.OnPush,
  providers: [{ provide: NG_VALUE_ACCESSOR, useExisting: forwardRef(() => NumeroComponent), multi: true }],
  template: `
    <p-inputgroup>
      <input
        pInputText
        class="w-full text-right tabular-nums"
        [id]="inputId()"
        [attr.data-testid]="testid()"
        [attr.aria-describedby]="descritoPor()"
        [attr.inputmode]="casas() > 0 ? 'decimal' : 'numeric'"
        autocomplete="off"
        [placeholder]="placeholder()"
        [value]="texto()"
        [disabled]="desabilitado()"
        (input)="aoDigitar($event)"
        (blur)="aoSair()"
      />
      @if (unidade()) {
        <p-inputgroup-addon data-testid="unidade">{{ unidade() }}</p-inputgroup-addon>
      }
    </p-inputgroup>
  `,
})
export class NumeroComponent extends CampoNumerico {
  /** `mm`, `kg`, `kW`, `un` — sem unidade, é um número puro (um ano, por exemplo). */
  readonly unidade = input<string>();
  readonly casas = input(0);
  /** Ponto de milhar. Desligue para o que não é quantidade: ano, código. */
  readonly agrupar = input(true);

  protected casasFixas(): number {
    return 0;
  }

  protected agrupa(): boolean {
    return this.agrupar();
  }

  protected paraModelo(número: number): number {
    return número;
  }

  protected doModelo(valor: number): number {
    return valor;
  }
}
