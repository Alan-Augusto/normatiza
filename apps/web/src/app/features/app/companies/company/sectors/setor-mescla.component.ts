import { Component, computed, inject, input, signal } from '@angular/core';
import { Button } from 'primeng/button';
import { Message } from 'primeng/message';

import type { SectorListItem } from '@normatiza/shared';

import { mensagemDoServidor } from '../../../../../core/http/mensagem-de-erro';
import { ModalRef } from '../../../../../core/modal/modal-ref';
import { InventoryService } from '../../../../../core/services/inventory.service';

/** Mesclar um setor noutro: as máquinas passam, e o de origem deixa de existir. Fecha com `true` ao mesclar. */
@Component({
  selector: 'app-setor-mescla',
  standalone: true,
  imports: [Button, Message],
  styleUrl: './setor-dialogos.css',
  template: `
    <div class="space-y-4">
      @if (erro()) {
        <p-message severity="error" styleClass="w-full" [text]="erro()!" />
      }
      <p class="text-sm text-surface-700 dark:text-surface-300">
        {{ equipamentos(origem().equipmentsCount) }} de <strong>{{ origem().name }}</strong> passam para o setor escolhido,
        e <strong>{{ origem().name }}</strong> deixa de existir. Use quando os dois são o mesmo lugar com nomes diferentes.
      </p>

      <div data-testid="destino-da-mescla" role="radiogroup" aria-label="Setor que fica" class="space-y-2">
        @for (destino of destinos(); track destino.id) {
          <label class="opcao" [attr.data-opcao]="destino.name">
            <input type="radio" name="destino" [value]="destino.id" [checked]="destinoEscolhido() === destino.id" (change)="destinoEscolhido.set(destino.id)" />
            <span>{{ destino.name }}</span>
            <span class="text-xs text-muted-color">· {{ equipamentos(destino.equipmentsCount) }}</span>
          </label>
        }
      </div>

      <div class="flex justify-end gap-2">
        <p-button label="Cancelar" severity="secondary" [text]="true" (onClick)="ref.fechar()" />
        <p-button data-testid="confirmar-mescla" label="Mesclar" [disabled]="!destinoEscolhido()" [loading]="processando()" (onClick)="mesclar()" />
      </div>
    </div>
  `,
})
export class SetorMesclaComponent {
  protected readonly ref = inject<ModalRef<boolean>>(ModalRef);
  private readonly inventory = inject(InventoryService);

  readonly companyId = input.required<string>();
  readonly origem = input.required<SectorListItem>();
  readonly setores = input.required<SectorListItem[]>();

  protected readonly destinoEscolhido = signal<string | null>(null);
  protected readonly processando = signal(false);
  protected readonly erro = signal<string | null>(null);

  /** Os setores que podem receber a mescla: todos menos o que sai. */
  protected readonly destinos = computed(() => this.setores().filter((s) => s.id !== this.origem().id));

  protected equipamentos(n: number): string {
    return n === 1 ? '1 equipamento' : `${n} equipamentos`;
  }

  protected mesclar(): void {
    const destino = this.destinoEscolhido();
    if (!destino || this.processando()) return;
    this.processando.set(true);
    this.erro.set(null);
    this.inventory.mergeSector(this.companyId(), this.origem().id, destino).subscribe({
      next: () => this.ref.fechar(true),
      error: (erro) => {
        this.processando.set(false);
        this.erro.set(mensagemDoServidor(erro, 'Não foi possível mesclar o setor.'));
      },
    });
  }
}
