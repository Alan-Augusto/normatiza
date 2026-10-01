import { Component, inject } from '@angular/core';
import { Button } from 'primeng/button';

import { ModalService } from '../../../core/modal/modal.service';
import { RoleGuideContentComponent } from './role-guide-content.component';

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
  imports: [Button],
  templateUrl: './role-guide.component.html',
})
export class RoleGuideComponent {
  private readonly modal = inject(ModalService);

  protected abrir(): void {
    this.modal.abrir(RoleGuideContentComponent, { titulo: 'O que cada papel faz', largura: '40rem', fecharClicandoFora: true });
  }
}
