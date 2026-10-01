import { ChangeDetectionStrategy, Component, computed, inject, input, signal } from '@angular/core';
import { Button } from 'primeng/button';
import { Observable } from 'rxjs';

import { ModalRef } from './modal-ref';

/** O corpo de `ModalService.confirmar`: o texto, Cancelar e o verbo. */
@Component({
  selector: 'app-confirmacao',
  standalone: true,
  imports: [Button],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <div class="space-y-4">
      @for (p of paragrafos(); track $index) {
        <p class="text-sm text-surface-700 dark:text-surface-300">
          @for (t of p; track $index) {
            @if (t.negrito) {
              <strong>{{ t.texto }}</strong>
            } @else {
              {{ t.texto }}
            }
          }
        </p>
      }
      <div class="flex justify-end gap-2">
        <p-button data-testid="cancelar-confirmacao" label="Cancelar" severity="secondary" [text]="true" [disabled]="processando()" (onClick)="ref.fechar(false)" />
        <p-button
          [attr.data-testid]="testid() ?? 'confirmar'"
          [label]="confirmar()"
          [severity]="perigo() ? 'danger' : undefined"
          [loading]="processando()"
          (onClick)="seguir()"
        />
      </div>
    </div>
  `,
})
export class ConfirmacaoComponent {
  protected readonly ref = inject<ModalRef<boolean>>(ModalRef);

  readonly texto = input.required<string[]>();
  readonly confirmar = input.required<string>();
  readonly perigo = input(true);
  readonly acao = input<(() => Observable<unknown>) | undefined>();
  readonly testid = input<string | undefined>();

  protected readonly processando = signal(false);

  /** `**nome**` vira negrito — sem HTML no texto, e sem `innerHTML`. */
  protected readonly paragrafos = computed(() =>
    this.texto().map((p) => p.split(/\*\*(.+?)\*\*/).map((texto, i) => ({ texto, negrito: i % 2 === 1 })).filter((t) => t.texto)),
  );

  protected seguir(): void {
    const acao = this.acao();
    if (!acao) return this.ref.fechar(true);
    if (this.processando()) return;
    this.processando.set(true);
    acao().subscribe({
      complete: () => this.ref.fechar(true),
      error: () => this.ref.fechar(false),
    });
  }
}
