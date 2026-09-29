import { DatePipe } from '@angular/common';
import { Component, OnInit, computed, inject, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { Button } from 'primeng/button';
import { Dialog } from 'primeng/dialog';
import { Message } from 'primeng/message';
import { provideIcons } from '@ng-icons/core';
import { lucideMail, lucideUserX } from '@ng-icons/lucide';

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
import { DataTable } from '../../../shared/components/data-table/data-table.component';
import {
  AcaoPrimaria,
  AcaoVazia,
  CabecalhoDaTabela,
  FiltrosAtivos,
  FiltrosAvancados,
  FiltrosRapidos,
  LinhaDaTabela,
} from '../../../shared/components/data-table/data-table.directives';
import { FilterChip } from '../../../shared/components/filter-chip/filter-chip.component';
import { FilterGroup, FilterMenuComponent } from '../../../shared/components/filter-menu/filter-menu.component';
import { QuickFilter } from '../../../shared/components/quick-filter/quick-filter.component';
import { InviteFormComponent } from '../../../shared/components/team/invite-form.component';
import { RoleGuideComponent } from '../../../shared/components/team/role-guide.component';
import {
  RoleEditorComponent,
  type VinculoEditavel,
} from '../../../shared/components/team/role-editor.component';
import { DisableDialogComponent } from './components/disable-dialog.component';
import { RowActionComponent } from '../../../shared/components/row-action/row-action.component';

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
    RowActionComponent,
    DatePipe,
    FormsModule,
    Button,
    Dialog,
    Message,
    DataTable,
    CabecalhoDaTabela,
    LinhaDaTabela,
    AcaoVazia,
    AcaoPrimaria,
    FiltrosAtivos,
    FiltrosAvancados,
    FiltrosRapidos,
    FilterChip,
    FilterMenuComponent,
    QuickFilter,
    InviteFormComponent,
    RoleGuideComponent,
    RoleEditorComponent,
    DisableDialogComponent,
  ],
  providers: [provideIcons({ lucideMail, lucideUserX })],
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

  /** Rótulo por método — o template não indexa mapa, e um papel novo quebra aqui. */
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

  readonly termo = signal('');

  readonly membrosFiltrados = computed(() => {
    const t = this.termo().toLowerCase().trim();
    if (!t) return this.membros();
    return this.membros().filter(
      (m) => m.name.toLowerCase().includes(t) || m.email.toLowerCase().includes(t),
    );
  });

  readonly contagemPendentes = computed(
    () => this.membros().filter((m) => m.status === 'INVITED').length,
  );

  readonly contagemDesligados = computed(
    () => this.membros().filter((m) => m.status === 'DISABLED').length,
  );

  alternarFiltroStatus(status: UserStatus): void {
    if (this.filtros().status === status) {
      this.filtrar('status', null);
    } else {
      this.filtrar('status', status);
    }
  }

  readonly gruposDeFiltro = computed<FilterGroup[]>(() => {
    const grupos: FilterGroup[] = [];

    grupos.push({
      id: 'papel',
      label: 'Papel',
      selectedValue: this.filtros().role ?? null,
      options: this.opcoesDePapel.map((p) => ({
        label: p.label,
        value: p.value,
        count: this.membros().filter((m) => this.papeisDe(m).includes(p.value)).length,
      })),
    });

    if (this.opcoesDeEmpresa().length > 1) {
      grupos.push({
        id: 'empresa',
        label: 'Empresa',
        selectedValue: this.filtros().companyId ?? null,
        options: this.opcoesDeEmpresa().map((e) => ({
          label: e.label,
          value: e.value,
          count: this.membros().filter((m) => m.memberships.some((v) => v.companyId === e.value)).length,
        })),
      });
    }

    grupos.push({
      id: 'status',
      label: 'Situação',
      selectedValue: this.filtros().status ?? null,
      options: this.opcoesDeStatus.map((s) => ({
        label: s.label,
        value: s.value,
        dotColor:
          s.value === 'ACTIVE'
            ? 'var(--p-green-500)'
            : s.value === 'INVITED'
              ? 'var(--p-amber-500)'
              : 'var(--p-surface-400)',
        count: this.membros().filter((m) => m.status === s.value).length,
      })),
    });

    return grupos;
  });

  aoMudarFiltro(evento: { groupId: string; value: unknown | null }): void {
    if (evento.groupId === 'papel') {
      this.filtrar('role', evento.value as Role | null);
    } else if (evento.groupId === 'empresa') {
      this.filtrar('companyId', evento.value as string | null);
    } else if (evento.groupId === 'status') {
      this.filtrar('status', evento.value as UserStatus | null);
    }
  }

  nomeDaEmpresaFiltro(companyId: string): string {
    return this.minhasEmpresas().find((e) => e.id === companyId)?.tradeName ?? 'Empresa';
  }

  rotuloDoStatusFiltro(status: UserStatus): string {
    return this.opcoesDeStatus.find((s) => s.value === status)?.label ?? status;
  }

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

  /**
   * Quem não concede papel nenhum não vê o botão.
   *
   * O Técnico é o caso: `CAN_INVITE.TECHNICIAN` é vazio, então o convite dele
   * nunca poderia dar em nada. Ele continua vendo a equipe — saber quem é o
   * Engenheiro Responsável não é privilégio administrativo —, mas oferecer uma
   * ação impossível é pior do que não oferecer: quem clica acha que quebrou.
   */
  readonly podeConvidar = computed(() => this.papeisQuePossoConceder().length > 0);

  /**
   * **O que não varia não aparece.**
   *
   * Uma coluna cujo valor é igual em todas as linhas — *para quem está
   * olhando* — não é informação, é peso. O Técnico alocado só na BRF recebe a
   * lista já recortada pelo escopo dele: toda linha diria "BRF", e a coluna
   * ocuparia largura para repetir o que o título da tela já disse.
   *
   * A conta é sobre as linhas **que chegaram**, e não sobre o que o papel
   * poderia alcançar: é o mesmo recorte que a pessoa está lendo.
   */
  readonly mostraEscopo = computed(
    () => new Set(this.membros().map((membro) => this.empresasDe(membro))).size > 1,
  );

  /**
   * A coluna de ações sem nenhuma ação em nenhuma linha é uma coluna vazia com
   * cabeçalho. Quem decide continua sendo o `actions` do servidor (D13) — aqui
   * só se pergunta se **alguma** linha tem algo a oferecer.
   */
  readonly mostraAcoes = computed(() =>
    this.membros().some((membro) => Object.values(membro.actions).some(Boolean)),
  );

  /** Lista vazia por filtro e lista vazia por não haver ninguém não são a mesma notícia. */
  readonly filtrando = computed(() => Object.values(this.filtros()).some(Boolean));

  readonly tituloDoVazio = computed(() =>
    this.filtrando() ? 'Ninguém encontrado com esses filtros.' : 'Sua equipe ainda está vazia.',
  );

  readonly detalheDoVazio = computed(() =>
    this.filtrando()
      ? 'Tente uma combinação mais ampla, ou limpe os filtros para ver todo mundo.'
      : 'Convide as pessoas que vão trabalhar com você — elas recebem o acesso por e-mail.',
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
