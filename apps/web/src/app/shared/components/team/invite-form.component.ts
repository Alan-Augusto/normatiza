import { Component, computed, inject, input, output, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { Button } from 'primeng/button';
import { Checkbox } from 'primeng/checkbox';
import { InputText } from 'primeng/inputtext';
import { Select } from 'primeng/select';

import {
  ROLE_LABEL,
  isCompanyScopedRole,
  type CompanySummary,
  type ExecutorType,
  type Role,
} from '@normatiza/shared';

import { TeamService } from '../../../core/services/team.service';
import { mensagemDoServidor } from '../../../core/http/mensagem-de-erro';

/**
 * O formulário de convite — o mesmo nas duas telas de equipe.
 *
 * A diferença entre elas não é o formulário, é o **escopo**: no Contexto 2 já
 * se sabe de qual empresa se está falando, e perguntar seria oferecer ao Gestor
 * uma escolha que ele não tem. Por isso `companyId` fixo esconde o seletor
 * inteiro em vez de deixá-lo com uma opção só.
 *
 * A lista de papéis **não é o enum**: é o que quem convida pode conceder. A
 * Carla vê "Técnico" e mais nada. Mostrar um papel que o servidor vai recusar é
 * convidar ao erro — e o servidor recusa de qualquer jeito, porque o teto é
 * validado lá.
 */
@Component({
  selector: 'app-invite-form',
  standalone: true,
  imports: [FormsModule, Button, Checkbox, InputText, Select],
  templateUrl: './invite-form.component.html',
})
export class InviteFormComponent {
  private readonly team = inject(TeamService);

  /** Os papéis que quem está convidando pode conceder. */
  readonly roles = input.required<readonly Role[]>();

  /** As empresas oferecidas. Vazio quando a empresa já está decidida. */
  readonly companies = input<readonly CompanySummary[]>([]);

  /** Contexto 2: a empresa da rota, sem pergunta nenhuma. */
  readonly fixedCompanyId = input<string>();

  readonly created = output<void>();

  readonly nome = signal('');
  readonly email = signal('');
  readonly cargo = signal('');
  readonly telefone = signal('');
  readonly papel = signal<Role | ''>('');
  readonly tipoDeExecutor = signal<ExecutorType>('INTERNAL');
  readonly empresasEscolhidas = signal<string[]>([]);
  readonly enviando = signal(false);
  readonly erro = signal<string | null>(null);

  /** O `p-select` fala em `{ label, value }`; o rótulo é o que a pessoa lê. */
  readonly opcoesDePapel = computed(() =>
    this.roles().map((papel) => ({ label: ROLE_LABEL[papel], value: papel })),
  );

  readonly opcoesDeExecutor = [
    { label: 'Interno', value: 'INTERNAL' },
    { label: 'Terceiro', value: 'THIRD_PARTY' },
  ];

  readonly ehExecutor = computed(() => this.papel() === 'EXECUTOR');

  /**
   * Papel de escopo-empresa vale numa empresa só — a mesma invariante que a
   * troca de papel antecipa. Aqui ela aparece antes de existir vínculo algum.
   */
  readonly escopoDemaisDeUma = computed(() => {
    const papel = this.papel();
    return papel !== '' && isCompanyScopedRole(papel) && this.empresasEscolhidas().length > 1;
  });

  readonly podeEnviar = computed(
    () =>
      !this.enviando() &&
      this.nome().trim().length > 0 &&
      this.email().trim().length > 0 &&
      this.papel() !== '' &&
      !this.escopoDemaisDeUma() &&
      this.escopo().length > 0,
  );

  private escopo(): string[] {
    const fixa = this.fixedCompanyId();
    return fixa ? [fixa] : this.empresasEscolhidas();
  }

  alternarEmpresa(companyId: string, marcada: boolean): void {
    this.empresasEscolhidas.update((atuais) =>
      marcada ? [...atuais, companyId] : atuais.filter((id) => id !== companyId),
    );
  }

  enviar(): void {
    const papel = this.papel();
    if (papel === '' || !this.podeEnviar()) return;

    this.enviando.set(true);
    this.erro.set(null);

    this.team
      .invite({
        name: this.nome().trim(),
        email: this.email().trim(),
        roles: [papel],
        companyIds: this.escopo(),
        ...(this.ehExecutor() ? { executorType: this.tipoDeExecutor() } : {}),
        ...(this.cargo().trim() ? { jobTitle: this.cargo().trim() } : {}),
        ...(this.telefone().trim() ? { phone: this.telefone().trim() } : {}),
      })
      .subscribe({
        next: () => {
          this.enviando.set(false);
          this.created.emit();
        },
        error: (falha: unknown) => {
          this.enviando.set(false);
          this.erro.set(mensagemDoServidor(falha, 'Não foi possível enviar o convite.'));
        },
      });
  }
}
