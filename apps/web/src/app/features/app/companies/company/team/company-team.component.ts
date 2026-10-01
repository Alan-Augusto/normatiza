import { DatePipe } from '@angular/common';
import { Component, computed, inject, signal } from '@angular/core';
import { Button } from 'primeng/button';
import { Message } from 'primeng/message';
import { tap } from 'rxjs';

import {
  ROLE_LABEL,
  invitableRoles,
  type CompanyMember,
  type MemberOrigin,
  type Role,
  type TechnicalResponsible,
} from '@normatiza/shared';

import { AuthService } from '../../../../../core/auth/auth.service';
import { empresaDaRota } from '../../../../../core/routing/empresa-da-rota';
import { mensagemDoServidor } from '../../../../../core/http/mensagem-de-erro';
import { TeamService } from '../../../../../core/services/team.service';
import { provideIcons } from '@ng-icons/core';
import { lucideMail } from '@ng-icons/lucide';
import { DataTable } from '../../../../../shared/components/data-table/data-table.component';
import {
  AcaoPrimaria,
  AcaoVazia,
  CabecalhoDaTabela,
  FiltrosAtivos,
  FiltrosAvancados,
  FiltrosRapidos,
  LinhaDaTabela,
  TituloDeGrupo,
} from '../../../../../shared/components/data-table/data-table.directives';
import { FilterChip } from '../../../../../shared/components/filter-chip/filter-chip.component';
import { FilterGroup, FilterMenuComponent } from '../../../../../shared/components/filter-menu/filter-menu.component';
import { QuickFilter } from '../../../../../shared/components/quick-filter/quick-filter.component';
import { InviteFormComponent } from '../../../../../shared/components/team/invite-form.component';
import { RoleGuideComponent } from '../../../../../shared/components/team/role-guide.component';
import {
  RoleEditorComponent,
  type VinculoEditavel,
} from '../../../../../shared/components/team/role-editor.component';
import { RowActionComponent } from '../../../../../shared/components/row-action/row-action.component';
import { ModalService } from '@core/modal/modal.service';

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
 * 3. **A consultoria não é linha de tabela para o cliente** (D25). Quem presta
 *    o serviço e quem assina por ele aparecem como contexto — nome e registro,
 *    o que já vai impresso no laudo. O recorte é do servidor: esta tela desenha
 *    o que recebe e não esconde nada por conta própria, senão o cadastro da
 *    consultoria continuaria legível no inspetor do navegador.
 */
@Component({
  selector: 'app-company-team',
  standalone: true,
  imports: [
    RowActionComponent,
    DatePipe,
    Button,
    Message,
    DataTable,
    CabecalhoDaTabela,
    LinhaDaTabela,
    AcaoVazia,
    AcaoPrimaria,
    FiltrosAtivos,
    FiltrosAvancados,
    FiltrosRapidos,
    TituloDeGrupo,
    FilterChip,
    FilterMenuComponent,
    QuickFilter,
    RoleGuideComponent,
  ],
  providers: [provideIcons({ lucideMail })],
  templateUrl: './company-team.component.html',
  styleUrl: './company-team.component.css',
})
export class CompanyTeamComponent {
  private readonly team = inject(TeamService);
  private readonly modal = inject(ModalService);
  private readonly auth = inject(AuthService);

  private readonly empresa = empresaDaRota();

  /** O id da empresa — a URL traz o slug, e a API fala por id. */
  readonly companyId = computed(() => this.empresa()?.id ?? '');

  readonly membros = signal<CompanyMember[]>([]);
  readonly nomeDaConsultoria = signal('');
  readonly responsaveisTecnicos = signal<TechnicalResponsible[]>([]);
  readonly carregando = signal(false);
  readonly erro = signal<string | null>(null);
  readonly aviso = signal<string | null>(null);


  readonly termo = signal('');
  readonly filtroPapel = signal<Role | null>(null);
  readonly filtroStatus = signal<string | null>(null);

  readonly contagemPendentes = computed(
    () => this.membros().filter((m) => m.status === 'INVITED').length,
  );

  alternarFiltroStatus(status: string): void {
    if (this.filtroStatus() === status) {
      this.filtroStatus.set(null);
    } else {
      this.filtroStatus.set(status);
    }
  }

  readonly opcoesDePapelDisponiveis = computed(() => {
    const papeis = new Set<Role>();
    for (const m of this.membros()) {
      for (const r of m.roles) {
        papeis.add(r);
      }
    }
    return [...papeis].map((p) => ({
      label: ROLE_LABEL[p],
      value: p,
      count: this.membros().filter((m) => m.roles.includes(p)).length,
    }));
  });

  readonly opcoesDeStatusDisponiveis = [
    { label: 'Ativo', value: 'ACTIVE', dotColor: 'var(--p-green-500)' },
    { label: 'Convite pendente', value: 'INVITED', dotColor: 'var(--p-amber-500)' },
    { label: 'Sem acesso', value: 'DISABLED', dotColor: 'var(--p-surface-400)' },
  ];

  readonly gruposDeFiltro = computed<FilterGroup[]>(() => {
    const grupos: FilterGroup[] = [];

    if (this.opcoesDePapelDisponiveis().length > 0) {
      grupos.push({
        id: 'papel',
        label: 'Papel',
        selectedValue: this.filtroPapel(),
        options: this.opcoesDePapelDisponiveis(),
      });
    }

    grupos.push({
      id: 'status',
      label: 'Situação',
      selectedValue: this.filtroStatus(),
      options: this.opcoesDeStatusDisponiveis.map((s) => ({
        ...s,
        count: this.membros().filter((m) => m.status === s.value).length,
      })),
    });

    return grupos;
  });

  aoMudarFiltro(evento: { groupId: string; value: unknown | null }): void {
    if (evento.groupId === 'papel') {
      this.filtroPapel.set(evento.value as Role | null);
    } else if (evento.groupId === 'status') {
      this.filtroStatus.set(evento.value as string | null);
    }
  }

  rotuloDoStatus(status: string): string {
    return this.opcoesDeStatusDisponiveis.find((s) => s.value === status)?.label ?? status;
  }

  /** Rótulo por método — o template não indexa mapa, e um papel novo quebra aqui. */
  rotuloDoPapel(papel: Role): string {
    return ROLE_LABEL[papel];
  }

  /**
   * O título do bloco é o **nome** de quem está ali, não a classificação.
   *
   * "Cliente" é a palavra da consultoria para a BRF — não a palavra da BRF para
   * si mesma. A Débora abre a tela da empresa dela e leria um rótulo escrito do
   * ponto de vista de quem a atende: o mesmo vazamento de vocabulário que o D1
   * existe para impedir, em forma de cabeçalho. Com o nome, cada bloco se
   * explica sozinho e ninguém precisa traduzir a taxonomia do sistema.
   *
   * O terceiro é o único que continua classificado, e por falta de dado, não
   * por escolha: a empresa prestadora não existe no sistema (D11).
   */
  rotuloDoBloco(origem: MemberOrigin): string {
    if (origem === 'CONSULTANCY') return this.nomeDaConsultoria();
    if (origem === 'CLIENT') return this.nomeDaEmpresa();
    return 'Terceiros contratados';
  }

  /**
   * "Pessoas", e não "registros": a lista é de gente com acesso, e "registro"
   * já é outra coisa nesta mesma tela — o CREA de quem assina o laudo.
   */
  contagemDoBloco(origem: MemberOrigin): string {
    const quantas = this.quantasNaOrigem(origem);
    return quantas === 1 ? '1 pessoa' : `${quantas} pessoas`;
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
   * O Diretor é o caso desta tela: `CAN_INVITE.DIRECTOR` é vazio, e ele
   * continua vendo quem tem acesso à empresa dele — numa ferramenta de
   * conformidade, essa lista é material de auditoria, não privilégio de quem
   * administra. O que some é só o botão que não poderia dar em nada.
   */
  readonly podeConvidar = computed(() => this.papeisQuePossoConceder().length > 0);

  /**
   * A ordem dos blocos: quem me atende, quem trabalha aqui, quem foi
   * contratado para a obra. Não é alfabética nem a do enum — é a distância
   * contratual em relação a quem administra a planta.
   */
  private readonly ordemDaOrigem: readonly MemberOrigin[] = ['CONSULTANCY', 'CLIENT', 'EXTERNAL'];

  /**
   * A lista agrupada por origem (D22).
   *
   * "Quem tem acesso a esta empresa" é uma pergunta que se responde em três
   * baldes, e era servida como corrida única. O agrupamento também resolve um
   * defeito silencioso: as linhas da consultoria chegam ao Marcos sem ação
   * nenhuma — ele vê a Carla e não a remove —, e numa lista plana isso lê como
   * linha quebrada. Num bloco chamado "Consultoria" lê como o que é.
   *
   * A ordenação é aqui e não no servidor porque é decisão de apresentação; o
   * `p-table` abre um grupo a cada troca de valor, então a lista **precisa**
   * chegar ordenada ou o mesmo título apareceria três vezes.
   */
  readonly membrosAgrupados = computed(() => {
    let lista = this.membros();

    const t = this.termo().toLowerCase().trim();
    if (t) {
      lista = lista.filter(
        (m) => m.name.toLowerCase().includes(t) || m.email.toLowerCase().includes(t),
      );
    }

    const papel = this.filtroPapel();
    if (papel) {
      lista = lista.filter((m) => m.roles.includes(papel));
    }

    const st = this.filtroStatus();
    if (st) {
      lista = lista.filter((m) => m.status === st);
    }

    return [...lista].sort(
      (a, b) => this.ordemDaOrigem.indexOf(a.origin) - this.ordemDaOrigem.indexOf(b.origin),
    );
  });

  /**
   * A linha de contexto aparece para quem **não** tem a consultoria na lista.
   *
   * Derivado dos dados, e não de um sinalizador a mais: quando o servidor
   * recortou (D25), não há linha de origem `CONSULTANCY`; quando quem olha é da
   * consultoria, elas estão ali e a frase deixaria de ser notícia — seria
   * contar à Carla quem é a Carla.
   */
  readonly mostraContextoDaConsultoria = computed(
    () =>
      this.nomeDaConsultoria().length > 0 &&
      !this.membros().some((membro) => membro.origin === 'CONSULTANCY'),
  );

  /** Quantas pessoas há no bloco — a contagem que faz a lista virar resumo. */
  quantasNaOrigem(origem: MemberOrigin): number {
    return this.membros().filter((membro) => membro.origin === origem).length;
  }

  /**
   * Coluna de ações sem ação nenhuma é cabeçalho sobre o vazio. É o caso da
   * Débora, que acompanha e não administra.
   */
  readonly mostraAcoes = computed(() =>
    this.membros().some((membro) => Object.values(membro.actions).some(Boolean)),
  );


  constructor() {
    this.carregar();
  }

  /**
   * O nome vem da sessão, do vínculo de quem está olhando — não de um `GET` na
   * empresa. Quem abre esta tela tem acesso a ela, então o nome já está na mão.
   */
  nomeDaEmpresa(): string {
    return this.auth.companyInScope(this.companyId())?.tradeName ?? 'esta empresa';
  }

  carregar(): void {
    this.carregando.set(true);
    this.erro.set(null);

    this.team.listCompanyMembers(this.companyId()).subscribe({
      next: (equipe) => {
        this.membros.set(equipe.members);
        this.nomeDaConsultoria.set(equipe.accountName);
        this.responsaveisTecnicos.set(equipe.technicalResponsibles);
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

  /** Sem seletor de empresas: aqui já se sabe qual, e a rota deu a resposta. */
  convidar(): void {
    const ref = this.modal.abrir(InviteFormComponent, {
      titulo: `Convidar para ${this.nomeDaEmpresa()}`,
      largura: '38rem',
      entradas: { roles: this.papeisQuePossoConceder(), fixedCompanyId: this.companyId() },
      saidas: { created: () => this.concluir(ref) },
    });
  }

  /**
   * Um vínculo só — o desta empresa. Os outros a pessoa até pode ter, mas esta
   * tela não os recebe, e é justamente esse o ponto do D15.
   */
  trocarPapel(membro: CompanyMember): void {
    const vinculos: VinculoEditavel[] = [
      { membershipId: membro.membershipId, companyId: this.companyId(), companyName: this.nomeDaEmpresa(), roles: membro.roles },
    ];
    const ref = this.modal.abrir(RoleEditorComponent, {
      titulo: `Papéis de ${membro.name}`,
      largura: '34rem',
      entradas: { memberName: membro.name, vinculos },
      saidas: { saved: () => this.concluir(ref) },
    });
  }

  remover(membro: CompanyMember): void {
    void this.modal.confirmar({
      titulo: `Remover ${membro.name} da empresa`,
      texto: `${membro.name} perde o acesso a ${this.nomeDaEmpresa()}. O cadastro continua existindo, e o histórico do que essa pessoa fez aqui não muda.`,
      confirmar: 'Remover da empresa',
      testid: 'confirmar-remocao',
      acao: () =>
        this.team.removeFromCompany(membro.membershipId).pipe(
          tap({
            next: () => this.carregar(),
            error: (falha: unknown) => this.erro.set(mensagemDoServidor(falha, 'Não foi possível remover da empresa.')),
          }),
        ),
    });
  }

  private concluir(ref: { fechar(): void }): void {
    ref.fechar();
    this.carregar();
  }
}
