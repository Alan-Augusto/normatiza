import { ChangeDetectionStrategy, Component, computed, input } from '@angular/core';

/**
 * A moldura de todo campo de formulário (docs/web/design_system.md §9): o
 * rótulo ligado ao controle, a marca de obrigatório ou opcional, e **uma linha
 * reservada** embaixo, para a mensagem.
 *
 * A linha existe mesmo vazia: sem ela, o erro nasceria empurrando o campo de
 * baixo, e a pessoa perderia a linha que estava lendo. Nela aparece uma coisa
 * só, na ordem do que mais importa — o erro, o aviso, a ajuda.
 */
@Component({
  selector: 'app-campo',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <div class="campo">
      <label [attr.for]="para()" class="rotulo">
        {{ rotulo() }}
        @if (marca() === 'obrigatorio') {
          <span class="obrigatorio" aria-hidden="true">*</span><span class="sr-only">(obrigatório)</span>
        } @else if (marca() === 'opcional') {
          <span class="opcional">opcional</span>
        }
        @if (detalhe()) {
          <span class="opcional">· {{ detalhe() }}</span>
        }
      </label>

      <ng-content />

      <p
        class="mensagem"
        [class.erro]="!!erro()"
        [class.aviso]="!erro() && !!aviso()"
        [attr.id]="mensagemId()"
        [attr.data-testid]="mensagemId()"
        [attr.role]="erro() ? 'alert' : null"
      >
        {{ mensagem() }}
      </p>
    </div>
  `,
  styles: `
    :host {
      display: block;
    }

    .campo {
      display: flex;
      flex-direction: column;
      gap: 0.375rem;
    }

    /* Contém o "(obrigatório)" de leitor de tela, que é absoluto (sr-only). */
    .rotulo {
      position: relative;
      font-size: 0.875rem;
      font-weight: 500;
      color: var(--p-text-color);
    }

    .obrigatorio {
      margin-left: 0.125rem;
      color: var(--p-red-500);
    }

    .opcional {
      margin-left: 0.25rem;
      font-size: var(--text-xs);
      font-weight: 400;
      color: var(--p-text-muted-color);
    }

    .mensagem {
      min-height: 1rem;
      font-size: var(--text-xs);
      line-height: 1rem;
      color: var(--p-text-muted-color);
    }

    .mensagem.erro {
      color: var(--p-red-500);
    }

    .mensagem.aviso {
      color: var(--p-amber-600, var(--p-amber-500));
    }
  `,
})
export class CampoComponent {
  /** O `id` do controle: é o que liga o rótulo a ele. */
  readonly para = input.required<string>();
  readonly rotulo = input.required<string>();
  /**
   * Marca-se a **minoria**: no formulário em que quase tudo é opcional, o
   * obrigatório leva asterisco; no que quase tudo é obrigatório, o opcional
   * leva a palavra. Marcar os dois é ruído.
   */
  readonly marca = input<'obrigatorio' | 'opcional' | null>(null);
  /** Um complemento curto ao rótulo: "única na empresa", "para que a máquina serve". */
  readonly detalhe = input<string | null>(null);
  readonly ajuda = input<string | null>(null);
  readonly aviso = input<string | null>(null);
  readonly erro = input<string | null>(null);
  /** `id` da linha de mensagem — o controle aponta para ele com `aria-describedby`. */
  readonly mensagemId = input<string | null>(null);

  readonly mensagem = computed(() => this.erro() ?? this.aviso() ?? this.ajuda() ?? '');
}
