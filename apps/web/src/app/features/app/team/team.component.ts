import { DatePipe } from '@angular/common';
import { Component, OnInit, computed, inject, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { Button } from 'primeng/button';
import { Dialog } from 'primeng/dialog';
import { Message } from 'primeng/message';
import { Select } from 'primeng/select';
import { TableModule } from 'primeng/table';

import {
  ROLE_LABEL,
  invitableRoles,
  type CompanySummary,
  type Role,
  type TeamListQuery,
  type TeamMember,
  type UserStatus,
} from '@normatiza/shared';

import { AuthService } from '../../../core/auth/auth.service';
import { TeamService } from '../../../core/services/team.service';
import { InviteFormComponent } from '../../../shared/components/team/invite-form.component';
import {
  RoleEditorComponent,
  type VinculoEditavel,
} from '../../../shared/components/team/role-editor.component';
import { DisableDialogComponent } from './components/disable-dialog.component';

/**
 * Equipe — Contexto 1.
 *
 * Quem tem acesso **à conta**: a consultoria inteira, mais o pessoal de cliente
 * e os terceiros que ela convidou.
 *
 * A tela **não decide** o que pode ser feito com cada pessoa. Cada linha chega
 * com `actions`, calculado pelo servidor a partir da alçada de quem está
 * olhando (D13). Recalcular aqui seria manter uma segunda implementação de uma
 * regra de autorização, em outra linguagem, condenada a divergir da primeira.
 */
@Component({
  selector: 'app-team',
  standalone: true,
  imports: [
    DatePipe,
    FormsModule,
    Button,
    Dialog,
    Message,
    Select,
    TableModule,
    InviteFormComponent,
    RoleEditorComponent,
    DisableDialogComponent,
  ],
  templateUrl: './team.component.html',
  styleUrl: './team.component.css',
})
export class TeamComponent implements OnInit {
  private readonly team = inject(TeamService);
  private readonly auth = inject(AuthService);

  readonly membros = signal<TeamMember[]>([]);
  readonly carregando = signal(false);
  readonly erro = signal<string | null>(null);
  readonly aviso = signal<string | null>(null);

  readonly filtros = signal<TeamListQuery>({});

  readonly convidando = signal(false);
  readonly editando = signal<TeamMember | null>(null);
  readonly desligando = signal<TeamMember | null>(null);

  /**
   * Rótulo por método, e não `rotulo[papel]` no template: o `p-table` entrega a
   * linha como `any`, e indexar com `any` desliga a checagem de tipo bem no
   * ponto em que um papel novo no enum deveria quebrar a compilação.
   */
  rotuloDoPapel(papel: Role): string {
    return ROLE_LABEL[papel];
  }

  readonly opcoesDePapel = (Object.keys(ROLE_LABEL) as Role[]).map((papel) => ({
    label: ROLE_LABEL[papel],
    value: papel,
  }));

  readonly opcoesDeStatus: { label: string; value: UserStatus }[] = [
    { label: 'Ativo', value: 'ACTIVE' },
    { label: 'Convite pendente', value: 'INVITED' },
    { label: 'Desligado', value: 'DISABLED' },
  ];

  /** As empresas de quem está olhando — teto de escopo do convite e do filtro. */
  readonly minhasEmpresas = computed<CompanySummary[]>(() => {
    const porId = new Map<string, CompanySummary>();
    for (const vinculo of this.auth.session()?.memberships ?? []) {
      if (vinculo.isActive) porId.set(vinculo.companyId, vinculo.company);
    }
    return [...porId.values()];
  });

  readonly opcoesDeEmpresa = computed(() =>
    this.minhasEmpresas().map((empresa) => ({ label: empresa.tradeName, value: empresa.id })),
  );

  /** O teto de papel: o que **quem está olhando** pode conceder, não o enum. */
  readonly papeisQuePossoConceder = computed<Role[]>(() =>
    invitableRoles(
      (this.auth.session()?.memberships ?? [])
        .filter((vinculo) => vinculo.isActive)
        .flatMap((vinculo) => vinculo.roles),
    ),
  );

  ngOnInit(): void {
    this.carregar();
  }

  carregar(): void {
    this.carregando.set(true);
    this.erro.set(null);

    this.team.listTeam(this.filtros()).subscribe({
      next: (membros) => {
        this.membros.set(membros);
        this.carregando.set(false);
      },
      error: () => {
        this.carregando.set(false);
        this.erro.set('Não foi possível carregar a equipe.');
      },
    });
  }

  filtrar(campo: keyof TeamListQuery, valor: string | null): void {
    this.filtros.update((atuais) => ({ ...atuais, [campo]: valor ?? undefined }));
    this.carregar();
  }

  papeisDe(membro: TeamMember): Role[] {
    return [...new Set(membro.memberships.flatMap((vinculo) => vinculo.roles))];
  }

  empresasDe(membro: TeamMember): string {
    return membro.memberships.map((vinculo) => vinculo.company.tradeName).join(' · ');
  }

  /**
   * `computed`, e não um método chamado do template: um método devolveria um
   * array novo a cada ciclo de detecção, o editor entenderia isso como "outra
   * pessoa" e desfaria as marcações no meio da edição.
   */
  readonly vinculosDoEditando = computed<VinculoEditavel[]>(() =>
    (this.editando()?.memberships ?? []).map((vinculo) => ({
      membershipId: vinculo.id,
      companyId: vinculo.companyId,
      companyName: vinculo.company.tradeName,
      roles: vinculo.roles,
    })),
  );

  /**
   * "Expirado" **não é status**: é `expiresAt` no passado. Guardar os dois no
   * servidor criaria duas verdades sobre o mesmo fato, que divergiriam no
   * minuto em que um job de expiração falhasse. Quem compara é o relógio daqui.
   */
  expirado(membro: TeamMember): boolean {
    const convite = membro.invitation;
    return !!convite && new Date(convite.expiresAt).getTime() < Date.now();
  }

  diasParaExpirar(membro: TeamMember): number {
    const convite = membro.invitation;
    if (!convite) return 0;
    const restante = new Date(convite.expiresAt).getTime() - Date.now();
    return Math.max(0, Math.ceil(restante / 86_400_000));
  }

  reenviar(membro: TeamMember): void {
    const convite = membro.invitation;
    if (!convite) return;

    this.aviso.set(null);
    this.team.resendInvitation(convite.id).subscribe({
      next: () => this.aviso.set(`Convite reenviado para ${membro.email}.`),
      error: () => this.erro.set('Não foi possível reenviar o convite.'),
    });
  }

  revogar(membro: TeamMember): void {
    const convite = membro.invitation;
    if (!convite) return;

    this.team.revokeInvitation(convite.id).subscribe({
      next: () => this.carregar(),
      error: () => this.erro.set('Não foi possível revogar o convite.'),
    });
  }

  concluir(): void {
    this.convidando.set(false);
    this.editando.set(null);
    this.desligando.set(null);
    this.carregar();
  }
}
