import { ChangeDetectionStrategy, Component, forwardRef } from '@angular/core';
import { NG_VALUE_ACCESSOR } from '@angular/forms';
import { InputGroup } from 'primeng/inputgroup';
import { InputGroupAddon } from 'primeng/inputgroupaddon';
import { InputText } from 'primeng/inputtext';

import { CampoNumerico } from './campo-numerico';

/**
 * Dinheiro: `[ R$ | 1.234,56 ]`, com o símbolo **encostado à esquerda**, como
 * se escreve (docs/web/design_system.md §9).
 *
 * O formulário recebe **centavos** (`123456`), inteiro — campo monetário nunca
 * é ponto flutuante (docs/produto/04, convenções gerais).
 */
@Component({
  selector: 'app-moeda',
  standalone: true,
  imports: [InputGroup, InputGroupAddon, InputText],
  changeDetection: ChangeDetectionStrategy.OnPush,
  providers: [{ provide: NG_VALUE_ACCESSOR, useExisting: forwardRef(() => MoedaComponent), multi: true }],
  template: `
    <p-inputgroup>
      <p-inputgroup-addon data-testid="prefixo">R$</p-inputgroup-addon>
      <input
        pInputText
        class="w-full text-right tabular-nums"
        [id]="inputId()"
        [attr.data-testid]="testid()"
        [attr.aria-describedby]="descritoPor()"
        inputmode="decimal"
        autocomplete="off"
        [placeholder]="placeholder()"
        [value]="texto()"
        [disabled]="desabilitado()"
        (input)="aoDigitar($event)"
        (blur)="aoSair()"
      />
    </p-inputgroup>
  `,
})
export class MoedaComponent extends CampoNumerico {
  protected casas(): number {
    return 2;
  }

  protected casasFixas(): number {
    return 2;
  }

  protected agrupa(): boolean {
    return true;
  }

  protected paraModelo(reais: number): number {
    return Math.round(reais * 100);
  }

  protected doModelo(centavos: number): number {
    return centavos / 100;
  }
}
