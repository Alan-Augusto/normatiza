import { Injectable, Injector, Type, inject, signal } from '@angular/core';
import { Observable } from 'rxjs';

import { ConfirmacaoComponent } from './confirmacao.component';
import { ModalRef } from './modal-ref';

export interface OpcoesDoModal {
  titulo: string;
  /** Largura no computador; no celular o modal ocupa 95% da tela. */
  largura?: string;
  /** As entradas do componente, pelo nome de cada `input()`. Um signal entra ao vivo. */
  entradas?: Record<string, unknown>;
  /** As saídas do componente, pelo nome de cada `output()`. */
  saidas?: Record<string, (valor: unknown) => void>;
  testid?: string;
  /** Para o que só se lê: clicar fora fecha. Formulário não fecha assim — perderia o que se digitou. */
  fecharClicandoFora?: boolean;
}

export interface OpcoesDaConfirmacao {
  titulo: string;
  /** Um parágrafo, ou vários. `**trecho**` sai em negrito. */
  texto: string | string[];
  /** O verbo do botão: "Excluir", "Desativar". */
  confirmar: string;
  /** Vermelho, para o que apaga ou tira algo de alguém. Padrão: sim. */
  perigo?: boolean;
  /**
   * O que fazer ao confirmar. O modal fica aberto, com o botão carregando, até
   * terminar: fecha no sucesso e também no erro — quem chama mostra o erro na
   * tela dele, num `tap` ou `catchError` da própria ação.
   */
  acao?: () => Observable<unknown>;
  /** O `data-testid` do botão de confirmar. */
  testid?: string;
}

/** Um modal na pilha: o host desenha um `p-dialog` para cada. */
export interface ModalAberto {
  id: number;
  componente: Type<unknown>;
  opcoes: OpcoesDoModal;
  ref: ModalRef<unknown>;
  injector: Injector;
}

let proximo = 0;

/**
 * Os modais do sistema (docs/web/design_system.md §10). Um `p-dialog` só, no
 * `<app-modal-host>` do app, desenha o componente que se pede aqui — nenhuma
 * tela controla `visible` de diálogo. Abre-se um por cima do outro, se
 * preciso; trocar de página fecha todos.
 */
@Injectable({ providedIn: 'root' })
export class ModalService {
  private readonly injector = inject(Injector);
  readonly abertos = signal<ModalAberto[]>([]);

  abrir<R = unknown>(componente: Type<unknown>, opcoes: OpcoesDoModal): ModalRef<R> {
    const id = ++proximo;
    const ref = new ModalRef<R>(() => this.abertos.update((lista) => lista.filter((m) => m.id !== id)));
    const injector = Injector.create({ providers: [{ provide: ModalRef, useValue: ref }], parent: this.injector });
    this.abertos.update((lista) => [...lista, { id, componente, opcoes, ref: ref as ModalRef<unknown>, injector }]);
    return ref;
  }

  /** Pergunta antes de algo que tem consequência. `true` se confirmou e a ação deu certo. */
  async confirmar(opcoes: OpcoesDaConfirmacao): Promise<boolean> {
    const ref = this.abrir<boolean>(ConfirmacaoComponent, {
      titulo: opcoes.titulo,
      largura: '32rem',
      entradas: {
        texto: Array.isArray(opcoes.texto) ? opcoes.texto : [opcoes.texto],
        confirmar: opcoes.confirmar,
        perigo: opcoes.perigo ?? true,
        acao: opcoes.acao,
        testid: opcoes.testid,
      },
    });
    return (await ref.fechado) === true;
  }

  fecharTodos(): void {
    for (const m of [...this.abertos()].reverse()) m.ref.fechar();
  }
}
