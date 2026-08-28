import { DatePipe } from '@angular/common';
import { Component, computed, inject, signal } from '@angular/core';
import { Button } from 'primeng/button';
import { Dialog } from 'primeng/dialog';
import { Message } from 'primeng/message';
import { TableModule } from 'primeng/table';
import { toSignal } from '@angular/core/rxjs-interop';
import { ActivatedRoute } from '@angular/router';
import { map } from 'rxjs/operators';

import {
  MEMBER_ORIGIN_LABEL,
  ROLE_LABEL,
  invitableRoles,
  type CompanyMember,
  type MemberOrigin,
  type Role,
} from '@normatiza/shared';

import { AuthService } from '../../../../../core/auth/auth.service';
import { mensagemDoServidor } from '../../../../../core/http/mensagem-de-erro';
import { TeamService } from '../../../../../core/services/team.service';
import { InviteFormComponent } from '../../../../../shared/components/team/invite-form.component';
import {
  RoleEditorComponent,
  type VinculoEditavel,
} from '../../../../../shared/components/team/role-editor.component';

/**
 * Equipe da Empresa — Contexto 2.
 *
 * Quem tem acesso a **esta** empresa: a consultoria alocada, o pessoal do
 * próprio cliente e os terceiros.
 *
 * Duas coisas a distinguem da Equipe do Contexto 1, e nenhuma é cosmética:
 *
 * 1. **Aqui não se desliga da conta** (D8). O Marcos tira alguém da BRF; ele
 *    não apaga essa pessoa da Normatiza. A alçada é outra, e a linguagem do
 *    botão precisa dizer isso — "Remover da empresa", nunca "Excluir".
 * 2. **Nada revela outra empresa nem a conta** (D15). É por isso que a fonte é
 *    `GET /companies/:id/members` e não a lista da conta filtrada: a projeção
 *    da conta traria o escopo de cada pessoa junto, e o Marcos descobriria que
 *    a mesma consultoria atende a Seara.
 */
@Component({
  selector: 'app-company-team',
  standalone: true,
  imports: [DatePipe, Button, Dialog, Message, TableModule, InviteFormComponent, RoleEditorComponent],
  templateUrl: './company-team.component.html',
  styleUrl: './company-team.component.css',
})
export class CompanyTeamComponent {
  private readonly team = inject(TeamService);
  private readonly auth = inject(AuthService);
  private readonly route = inject(ActivatedRoute);

  readonly companyId = toSignal(
    this.route.paramMap.pipe(map((params) => params.get('companyId') ?? '')),
    { initialValue: this.route.snapshot.paramMap.get('companyId') ?? '' },
  );

  readonly membros = signal<CompanyMember[]>([]);
  readonly carregando = signal(false);
  readonly erro = signal<string | null>(null);
  readonly aviso = signal<string | null>(null);

  readonly convidando = signal(false);
  readonly editando = signal<CompanyMember | null>(null);
  readonly removendo = signal<CompanyMember | null>(null);

  /** Ver a nota em `team.component.ts`: o `p-table` entrega a linha como `any`. */
  rotuloDoPapel(papel: Role): string {
    return ROLE_LABEL[papel];
  }

  rotuloDaOrigem(origem: MemberOrigin): string {
    return MEMBER_ORIGIN_LABEL[origem];
  }

  /**
   * O teto de papel é a alçada de quem olha **nesta** empresa — não a soma do
   * que ela pode em toda a carteira. O Engenheiro Responsável que entra na BRF
   * convida para a BRF.
   */
  readonly papeisQuePossoConceder = computed<Role[]>(() =>
    invitableRoles(this.auth.rolesInCompany(this.companyId())),
  );

  /**
   * Um vínculo só — o desta empresa. Os outros a pessoa até pode ter, mas esta
   * tela não os recebe, e é justamente esse o ponto do D15.
   */
  readonly vinculoDoEditando = computed<VinculoEditavel[]>(() => {
    const membro = this.editando();
    if (!membro) return [];
    return [
      {
        membershipId: membro.membershipId,
        companyId: this.companyId(),
        companyName: this.nomeDaEmpresa(),
        roles: membro.roles,
      },
    ];
  });

  constructor() {
    this.carregar();
  }

  /**
   * O nome vem da sessão, do vínculo de quem está olhando — não de um `GET` na
   * empresa. Quem abre esta tela tem acesso a ela, então o nome já está na mão.
   */
  nomeDaEmpresa(): string {
    const vinculo = (this.auth.session()?.memberships ?? []).find(
      (item) => item.companyId === this.companyId(),
    );
    return vinculo?.company.tradeName ?? 'esta empresa';
  }

  carregar(): void {
    this.carregando.set(true);
    this.erro.set(null);

    this.team.listCompanyMembers(this.companyId()).subscribe({
      next: (membros) => {
        this.membros.set(membros);
        this.carregando.set(false);
      },
      error: () => {
        this.carregando.set(false);
        this.erro.set('Não foi possível carregar quem tem acesso a esta empresa.');
      },
    });
  }

  expirado(membro: CompanyMember): boolean {
    const convite = membro.invitation;
    return !!convite && new Date(convite.expiresAt).getTime() < Date.now();
  }

  reenviar(membro: CompanyMember): void {
    const convite = membro.invitation;
    if (!convite) return;

    this.aviso.set(null);
    this.team.resendInvitation(convite.id).subscribe({
      next: () => this.aviso.set(`Convite reenviado para ${membro.email}.`),
      error: () => this.erro.set('Não foi possível reenviar o convite.'),
    });
  }

  remover(): void {
    const membro = this.removendo();
    if (!membro) return;

    this.team.removeFromCompany(membro.membershipId).subscribe({
      next: () => this.concluir(),
      error: (falha: unknown) => {
        this.removendo.set(null);
        this.erro.set(mensagemDoServidor(falha, 'Não foi possível remover da empresa.'));
      },
    });
  }

  concluir(): void {
    this.convidando.set(false);
    this.editando.set(null);
    this.removendo.set(null);
    this.carregar();
  }
}
