import { Component, computed, forwardRef, input, signal } from '@angular/core';
import { FormsModule, NG_VALUE_ACCESSOR, type ControlValueAccessor } from '@angular/forms';
import { RadioButton } from 'primeng/radiobutton';

import {
  ROLE_LABEL,
  ROLE_LIMIT,
  ROLE_SIDE_LABEL,
  ROLE_SUMMARY,
  rolesBySide,
  type Role,
} from '@normatiza/shared';

/**
 * A escolha do papel no convite — em três formas, decididas pelo tamanho da
 * alçada de quem convida, nunca por configuração de tela.
 *
 * | Papéis | Quem é | A forma |
 * | :-: | :--- | :--- |
 * | **1** | Carla, Antonio | Nenhuma escolha: o papel é **declarado**, com a descrição. |
 * | **vários, um lado** | Marcos | Lista de opções, ordenada por alçada. |
 * | **vários, dois lados** | Josué | A mesma lista, com um título por lado. |
 *
 * **Por que não abas** (D21): só o Engenheiro Responsável alcança os dois lados
 * — a aba existiria para uma única pessoa do sistema, a mais experiente dele. E
 * aba esconde metade das opções: quem abre no lado errado precisa descobrir que
 * existe outro, e o papel escolhido pode acabar numa aba fechada, com o
 * formulário exibindo um estado que ninguém vê.
 *
 * **Por que declarar em vez de perguntar quando há um só:** é a mesma regra que
 * já esconde o seletor de empresas dentro de uma empresa — uma lista de uma
 * opção só é uma pergunta encenada. Mas a **descrição fica**: o Antonio não
 * escolhe nada e ainda assim precisa saber o que o Executor vai enxergar.
 */
@Component({
  selector: 'app-role-picker',
  standalone: true,
  imports: [FormsModule, RadioButton],
  providers: [
    {
      provide: NG_VALUE_ACCESSOR,
      useExisting: forwardRef(() => RolePickerComponent),
      multi: true,
    },
  ],
  templateUrl: './role-picker.component.html',
})
export class RolePickerComponent implements ControlValueAccessor {
  /** Os papéis que quem convida pode conceder — nunca o enum inteiro. */
  readonly roles = input.required<readonly Role[]>();

  protected readonly valor = signal<Role | ''>('');
  protected readonly desabilitado = signal(false);

  /** Um identificador por instância, para o `name` do grupo e os `for` dos rótulos. */
  protected readonly id = `papel-${Math.random().toString(36).slice(2, 8)}`;

  protected readonly grupos = computed(() => rolesBySide(this.roles()));

  /** Um papel só: nada a escolher. */
  protected readonly unico = computed(() => (this.roles().length === 1 ? this.roles()[0] : null));

  /** O título de lado só aparece quando há mais de um lado para distinguir. */
  protected readonly comTitulos = computed(() => this.grupos().length > 1);

  protected rotulo(papel: Role): string {
    return ROLE_LABEL[papel];
  }

  protected resumo(papel: Role): string {
    return ROLE_SUMMARY[papel];
  }

  protected limite(papel: Role): string {
    return ROLE_LIMIT[papel];
  }

  protected tituloDoLado(lado: keyof typeof ROLE_SIDE_LABEL): string {
    return ROLE_SIDE_LABEL[lado];
  }

  protected escolher(papel: Role): void {
    if (this.desabilitado()) return;
    this.valor.set(papel);
    this.aoMudar(papel);
    this.aoTocar();
  }

  // — ControlValueAccessor ————————————————————————————————————————

  private aoMudar: (valor: Role | '') => void = () => {};
  private aoTocar: () => void = () => {};

  writeValue(valor: Role | ''): void {
    this.valor.set(valor ?? '');
  }

  registerOnChange(fn: (valor: Role | '') => void): void {
    this.aoMudar = fn;
  }

  registerOnTouched(fn: () => void): void {
    this.aoTocar = fn;
  }

  setDisabledState(desabilitado: boolean): void {
    this.desabilitado.set(desabilitado);
  }
}
