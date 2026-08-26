import { Component } from '@angular/core';

/**
 * Área de Execução — o destino do Executor depois do login ([03 §1](../../../../../../docs/produto/03_navegacao_e_telas.md)).
 *
 * A rota existe porque a autenticação precisa de um destino real: `rotaDeEntrada`
 * manda o Executor para cá, e uma rota inexistente cairia no `**` e o
 * despejaria na página pública, sem explicação. As telas de tarefa vêm com a
 * feature de Execução — esta é a placa dizendo que o lugar existe e ainda está
 * vazio, não uma tela de mentira.
 */
@Component({
  selector: 'app-execution',
  standalone: true,
  template: `
    <p class="text-sm text-muted-color">
      Suas tarefas aparecerão aqui assim que a Área de Execução for publicada.
    </p>
  `,
})
export class ExecutionComponent {}
