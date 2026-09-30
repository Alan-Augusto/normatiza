import type { Signal } from '@angular/core';
import type { Observable } from 'rxjs';

/** O que salvar deu: gravou, não havia o que gravar, ou não gravou (a tela diz por quê). */
export type ResultadoDoSalvar = 'salvo' | 'nada' | 'erro';

/**
 * Uma etapa de lista com editor (pontos, PAP, PE), como o rodapé do assistente
 * a enxerga: os botões ficam todos lá embaixo, e mudam com o editor aberto.
 */
export interface EtapaComEditor {
  readonly editando: Signal<unknown | null>;
  readonly salvando: Signal<boolean>;
  salvarAberto(): Observable<ResultadoDoSalvar>;
  voltarALista(): void;
  salvarEAdicionar(): void;
  temAlteracoes(): boolean;
}
