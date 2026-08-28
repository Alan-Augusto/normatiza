import { Component, OnInit, computed, inject, input, output, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { Button } from 'primeng/button';
import { Message } from 'primeng/message';
import { Select } from 'primeng/select';
import { Textarea } from 'primeng/textarea';

import type { DisableUserPreview, TeamMember } from '@normatiza/shared';

import { TeamService } from '../../../../core/services/team.service';
import { mensagemDoServidor } from '../../../../core/http/mensagem-de-erro';

/**
 * Desligar alguém da conta.
 *
 * A primeira coisa que esta caixa faz é **perguntar ao servidor** (D14). Sem
 * isso ela teria de adivinhar quando a saída quebra alguma coisa — e erraria
 * para um dos dois lados: pedindo sucessor sempre, o que é burocracia em quase
 * todos os casos, ou nunca, o que entrega um erro de servidor a quem só queria
 * desligar um estagiário.
 *
 * O que a previa responde não é "pode?" apenas: é **por que não**, quando não
 * pode, e **quem pode herdar**, quando é preciso herdar.
 */
@Component({
  selector: 'app-disable-dialog',
  standalone: true,
  imports: [FormsModule, Button, Message, Select, Textarea],
  templateUrl: './disable-dialog.component.html',
})
export class DisableDialogComponent implements OnInit {
  private readonly team = inject(TeamService);

  readonly member = input.required<TeamMember>();
  readonly disabled = output<void>();

  readonly previa = signal<DisableUserPreview | null>(null);
  readonly sucessorId = signal('');
  readonly motivo = signal('');
  readonly enviando = signal(false);
  readonly erro = signal<string | null>(null);

  readonly opcoesDeSucessor = computed(() =>
    (this.previa()?.eligibleSuccessors ?? []).map((pessoa) => ({
      label: pessoa.name,
      value: pessoa.id,
    })),
  );

  readonly podeConfirmar = computed(() => {
    const previa = this.previa();
    if (!previa?.allowed || this.enviando()) return false;
    return !previa.requiresSuccessor || this.sucessorId() !== '';
  });

  ngOnInit(): void {
    this.team.disablePreview(this.member().id).subscribe({
      next: (previa) => this.previa.set(previa),
      error: () => this.erro.set('Não foi possível consultar o desligamento.'),
    });
  }

  confirmar(): void {
    if (!this.podeConfirmar()) return;

    this.enviando.set(true);
    this.erro.set(null);

    this.team
      .disable(this.member().id, {
        ...(this.sucessorId() ? { successorUserId: this.sucessorId() } : {}),
        ...(this.motivo().trim() ? { reason: this.motivo().trim() } : {}),
      })
      .subscribe({
        next: () => {
          this.enviando.set(false);
          this.disabled.emit();
        },
        error: (falha: unknown) => {
          this.enviando.set(false);
          this.erro.set(mensagemDoServidor(falha, 'Não foi possível desligar esta pessoa.'));
        },
      });
  }
}
