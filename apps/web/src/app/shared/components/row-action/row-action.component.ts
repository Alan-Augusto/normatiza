import { ChangeDetectionStrategy, Component, input, output } from '@angular/core';
import { RouterLink } from '@angular/router';
import { NgIconComponent, provideIcons } from '@ng-icons/core';
import {
  lucideEye,
  lucideMailX,
  lucidePencil,
  lucidePower,
  lucideRotateCcw,
  lucideSend,
  lucideShieldOff,
  lucideUserCog,
  lucideUserMinus,
  lucideUserPlus,
  lucideUserX,
} from '@ng-icons/lucide';
import { ButtonDirective } from 'primeng/button';
import { Tooltip } from 'primeng/tooltip';

/**
 * O vocabulário de ações de linha do sistema. Um ícone por **significado**, e
 * não por tela: "editar" é o lápis em toda tabela. Uma união fechada, e não
 * `string`, para que um ícone novo passe por aqui — e por esta decisão — antes
 * de aparecer numa linha.
 */
const ICONES = {
  lucideEye,
  lucidePencil,
  lucidePower,
  lucideRotateCcw,
  lucideSend,
  lucideMailX,
  lucideUserCog,
  lucideUserX,
  lucideUserMinus,
  lucideUserPlus,
  lucideShieldOff,
};

export type RowActionIcon = keyof typeof ICONES;

/**
 * Uma ação na linha de uma tabela: **ícone, com nome** (docs/web/design_system.md §6).
 *
 * O nome não é enfeite. Vai no `aria-label` — é o que o leitor de tela lê e o
 * que o teste confere — e no tooltip, que aparece no hover **e no foco do
 * teclado**. O ícone sozinho seria adivinhação para quem chega ao sistema.
 *
 * Link quando a ação é ir a outra tela (editar abre uma página); botão quando
 * ela acontece aqui (desativar pede confirmação num diálogo).
 */
@Component({
  selector: 'app-row-action',
  standalone: true,
  imports: [RouterLink, NgIconComponent, ButtonDirective, Tooltip],
  providers: [provideIcons(ICONES)],
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: './row-action.component.html',
  styleUrl: './row-action.component.css',
})
export class RowActionComponent {
  readonly icon = input.required<RowActionIcon>();

  /** O nome da ação, como a pessoa diria: "Remover da empresa", nunca "Excluir". */
  readonly label = input.required<string>();

  /** `danger` para o que tira algo de alguém — e que, por isso, sempre confirma antes. */
  readonly severity = input<'default' | 'danger'>('default');

  /** Quando presente, a ação é navegar: vira link, com endereço de verdade. */
  readonly link = input<string | readonly unknown[] | undefined>(undefined);

  readonly disabled = input(false);

  readonly acionar = output<void>();
}
