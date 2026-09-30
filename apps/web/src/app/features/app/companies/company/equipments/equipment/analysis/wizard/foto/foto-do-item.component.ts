import { Component, input, output, signal } from '@angular/core';
import { Button } from 'primeng/button';

import type { RecognitionPhoto } from '@normatiza/shared';

const FOTO_MAX_BYTES = 10 * 1024 * 1024;
const FOTO_TIPOS = ['image/png', 'image/jpeg', 'image/webp'];

/**
 * A foto de um item da análise: prévia, enviar ou trocar, remover. Só a tela —
 * quem envia é a etapa, que sabe se o item já existe no servidor.
 */
@Component({
  selector: 'app-foto-do-item',
  standalone: true,
  imports: [Button],
  template: `
    <div class="foto">
      <div class="previa">
        @if (foto(); as f) {
          <img [attr.data-testid]="testid()" [src]="f.thumbnailUrl" [alt]="rotulo()" />
        } @else {
          <span class="text-xs text-muted-color">Sem foto</span>
        }
      </div>
      <div class="space-y-1">
        <p class="text-sm font-medium">{{ rotulo() }}</p>
        @if (ajuda()) {
          <p class="text-xs text-muted-color">{{ ajuda() }}</p>
        }
        @if (editavel()) {
          <div class="flex flex-wrap gap-1">
            <label class="botao-arquivo" [class.ocupado]="enviando()" [for]="inputId()">
              {{ enviando() ? 'Enviando…' : foto() ? 'Trocar' : 'Enviar' }}
            </label>
            <input
              [id]="inputId()"
              [attr.data-testid]="testid() + '-arquivo'"
              type="file"
              accept="image/png,image/jpeg,image/webp"
              capture="environment"
              class="sr-only"
              [disabled]="enviando()"
              (change)="aoEscolher($event)"
            />
            @if (foto()) {
              <p-button [attr.data-testid]="testid() + '-remover'" label="Remover" severity="secondary" [text]="true" size="small" [disabled]="enviando()" (onClick)="remover.emit()" />
            }
          </div>
        }
        <p [attr.data-testid]="testid() + '-erro'" role="alert" class="erro">{{ erroLocal() ?? erro() }}</p>
      </div>
    </div>
  `,
  styles: `
    .foto {
      display: flex;
      flex-wrap: wrap;
      align-items: flex-start;
      gap: 1rem;
    }
    .previa {
      display: flex;
      width: 10rem;
      aspect-ratio: 4 / 3;
      align-items: center;
      justify-content: center;
      overflow: hidden;
      border-radius: var(--p-border-radius-lg);
      border: 1px solid var(--p-content-border-color);
      background: var(--p-content-hover-background);
    }
    .previa img {
      width: 100%;
      height: 100%;
      object-fit: cover;
    }
    .botao-arquivo {
      cursor: pointer;
      border-radius: var(--p-border-radius-md);
      border: 1px solid var(--p-content-border-color);
      padding: 0.25rem 0.625rem;
      font-size: 0.875rem;
      font-weight: 500;
      color: var(--p-text-color);
    }
    .botao-arquivo:hover {
      background: var(--p-content-hover-background);
    }
    .botao-arquivo.ocupado {
      cursor: progress;
      opacity: 0.6;
    }
    .erro {
      min-height: 1rem;
      font-size: var(--text-xs);
      line-height: 1rem;
      color: var(--color-danger);
    }
  `,
})
export class FotoDoItemComponent {
  readonly foto = input<RecognitionPhoto | undefined>();
  readonly rotulo = input.required<string>();
  readonly ajuda = input<string>();
  readonly inputId = input.required<string>();
  readonly testid = input.required<string>();
  readonly editavel = input(false);
  readonly enviando = input(false);
  readonly erro = input<string | null>(null);

  /** O arquivo já conferido: tipo e tamanho. */
  readonly escolher = output<File>();
  readonly remover = output<void>();

  protected readonly erroLocal = signal<string | null>(null);

  protected aoEscolher(evento: Event): void {
    const campo = evento.target as HTMLInputElement;
    const arquivo = campo.files?.[0];
    campo.value = '';
    this.erroLocal.set(null);
    if (!arquivo) return;
    if (!FOTO_TIPOS.includes(arquivo.type)) {
      this.erroLocal.set('A foto precisa ser PNG, JPG ou WebP.');
      return;
    }
    if (arquivo.size > FOTO_MAX_BYTES) {
      this.erroLocal.set('A foto pode ter no máximo 10 MB.');
      return;
    }
    this.escolher.emit(arquivo);
  }
}
