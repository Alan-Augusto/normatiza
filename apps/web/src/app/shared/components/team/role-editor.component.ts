import { Component, computed, inject, input, linkedSignal, output, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { Button } from 'primeng/button';
import { Checkbox } from 'primeng/checkbox';
import { Message } from 'primeng/message';
import { Select } from 'primeng/select';

import {
  ROLE_LABEL,
  invitableRoles,
  vínculoEmConflito,
  type Role,
} from '@normatiza/shared';

import { AuthService } from '../../../core/auth/auth.service';
import { TeamService } from '../../../core/services/team.service';
import { mensagemDoServidor } from '../../../core/http/mensagem-de-erro';

/** Um vínculo como este editor precisa dele: a empresa, o id e os papéis de lá. */
export interface VinculoEditavel {
  membershipId: string;
  companyId: string;
  companyName: string;
  roles: readonly Role[];
}

/**
 * Trocar o papel de alguém — **num vínculo por vez**.
 *
 * Papel é sempre "…nesta empresa": editar dois de uma vez pediria uma tela que
 * dissesse o tempo todo de qual se está falando, e a chance de trocar o papel
 * da empresa errada é grande demais para o estrago que causa.
 *
 * O aviso de conflito é **antecipação, não defesa**: quem impõe a invariante é
 * o índice parcial no Postgres. Dentro do Contexto 2 ele não tem como aparecer,
 * porque a projeção da empresa esconde de propósito os outros vinculos da
 * pessoa (D15) — lá a recusa vem do servidor, já em linguagem de negócio.
 */
@Component({
  selector: 'app-role-editor',
  standalone: true,
  imports: [FormsModule, Button, Checkbox, Message, Select],
  templateUrl: './role-editor.component.html',
})
export class RoleEditorComponent {
  private readonly team = inject(TeamService);
  private readonly auth = inject(AuthService);

  readonly memberName = input.required<string>();
  readonly vinculos = input.required<readonly VinculoEditavel[]>();
  /** Contexto 1 oferece encerrar o acesso àquela empresa; o Contexto 2 tem a sua própria. */
  readonly allowRemoval = input(false);

  readonly saved = output<void>();
  readonly removed = output<void>();

  readonly rotulo = ROLE_LABEL;

  readonly opcoesDeVinculo = computed(() =>
    this.vinculos().map((item) => ({ label: item.companyName, value: item.membershipId })),
  );

  /**
   * Abre no primeiro vínculo, e os papéis marcados são os que a pessoa já tem:
   * a tela mostra a verdade de hoje, não um formulário em branco. Trocar de
   * vínculo recarrega as marcações — daí `linkedSignal` e não `signal`.
   */
  private readonly escolhidoId = linkedSignal<string | null>(
    () => this.vinculos()[0]?.membershipId ?? null,
  );
  readonly escolhidos = linkedSignal<Role[]>(() => [...this.vinculo().roles]);
  readonly salvando = signal(false);
  readonly confirmandoRemocao = signal(false);
  readonly erro = signal<string | null>(null);

  readonly vinculo = computed<VinculoEditavel>(() => {
    const id = this.escolhidoId();
    return this.vinculos().find((v) => v.membershipId === id) ?? this.vinculos()[0];
  });

  /**
   * O que se pode marcar: o que quem edita concede **naquela empresa**, mais o
   * que a pessoa já tem. Sem a segunda metade, abrir a tela apagaria da vista
   * um papel que a pessoa carrega e que quem edita não alcança — e salvar o
   * removeria sem ninguém ter pedido.
   */
  readonly oferecidos = computed<Role[]>(() => {
    const alvo = this.vinculo();
    const meus = this.auth.rolesInCompany(alvo.companyId);
    return [...new Set<Role>([...invitableRoles(meus), ...alvo.roles])];
  });

  readonly conflito = computed(() => {
    const alvo = this.vinculo();
    return vínculoEmConflito(
      this.vinculos().map((v) => ({ ...v, isActive: true })),
      alvo.companyId,
      this.escolhidos(),
    );
  });

  readonly podeSalvar = computed(
    () => !this.salvando() && this.escolhidos().length > 0 && !this.conflito(),
  );

  selecionar(membershipId: string): void {
    this.escolhidoId.set(membershipId);
    this.confirmandoRemocao.set(false);
    this.erro.set(null);
  }

  temPapel(papel: Role): boolean {
    return this.escolhidos().includes(papel);
  }

  alternar(papel: Role, marcado: boolean): void {
    this.escolhidos.update((atuais) =>
      marcado ? [...atuais, papel] : atuais.filter((p) => p !== papel),
    );
  }

  salvar(): void {
    if (!this.podeSalvar()) return;

    this.salvando.set(true);
    this.erro.set(null);

    this.team.updateMembership(this.vinculo().membershipId, { roles: this.escolhidos() }).subscribe({
      next: () => {
        this.salvando.set(false);
        this.saved.emit();
      },
      error: (falha: unknown) => {
        this.salvando.set(false);
        this.erro.set(mensagemDoServidor(falha, 'Não foi possível salvar os papéis.'));
      },
    });
  }

  remover(): void {
    this.salvando.set(true);
    this.erro.set(null);

    this.team.removeFromCompany(this.vinculo().membershipId).subscribe({
      next: () => {
        this.salvando.set(false);
        this.removed.emit();
      },
      error: (falha: unknown) => {
        this.salvando.set(false);
        this.confirmandoRemocao.set(false);
        this.erro.set(mensagemDoServidor(falha, 'Não foi possível remover da empresa.'));
      },
    });
  }
}
