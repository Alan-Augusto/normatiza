import { Component, signal } from '@angular/core';
import { Button } from 'primeng/button';
import { Dialog } from 'primeng/dialog';

import {
  ROLE_LABEL,
  ROLE_LIMIT,
  ROLE_ORDER,
  ROLE_SIDE_LABEL,
  ROLE_SUMMARY,
  rolesBySide,
  type Role,
} from '@normatiza/shared';

/**
 * "O que cada papel faz" — o diálogo que responde à queixa que originou a
 * Fase 7: *"estou meio perdido com tanto papel diferente"*.
 *
 * O problema nunca foi falta de informação: é que o sistema **nomeia** papéis
 * em toda tabela e nunca diz o que eles alcançam. Um selo escrito "Engenheiro
 * do Cliente" não conta a ninguém que essa pessoa jamais toca na análise.
 *
 * **Por que um diálogo e não uma dica no selo.** Explicar por `title`/*hover*
 * é o anti-padrão de prioridade 2 da base de UX — *reliance on hover only*:
 * morre no toque, onde não existe cursor, e não chega a leitor de tela. O
 * diálogo funciona nos três, é alcançável pelo teclado e cabe numa tela de
 * celular.
 *
 * Mostra **todos** os papéis, inclusive os que quem está lendo não concede: o
 * Marcos vê a Carla na lista da BRF marcada como "Engenheira da Consultoria" e
 * precisa saber o que isso significa, mesmo sem poder conceder esse papel.
 */
@Component({
  selector: 'app-role-guide',
  standalone: true,
  imports: [Button, Dialog],
  templateUrl: './role-guide.component.html',
})
export class RoleGuideComponent {
  protected readonly aberto = signal(false);

  /** Todos os papéis, por lado, na ordem de alçada — nunca alfabética. */
  protected readonly grupos = rolesBySide(ROLE_ORDER).map((grupo) => ({
    ...grupo,
    titulo: ROLE_SIDE_LABEL[grupo.side],
  }));

  protected rotulo(papel: Role): string {
    return ROLE_LABEL[papel];
  }

  protected resumo(papel: Role): string {
    return ROLE_SUMMARY[papel];
  }

  protected limite(papel: Role): string {
    return ROLE_LIMIT[papel];
  }

  protected abrir(): void {
    this.aberto.set(true);
  }
}
