import { DatePipe } from '@angular/common';
import { Component, computed, inject, signal } from '@angular/core';
import { Button } from 'primeng/button';
import { Dialog } from 'primeng/dialog';
import { Message } from 'primeng/message';
import { toSignal } from '@angular/core/rxjs-interop';
import { ActivatedRoute } from '@angular/router';
import { map } from 'rxjs/operators';

import {
  ROLE_LABEL,
  invitableRoles,
  type CompanyMember,
  type MemberOrigin,
  type Role,
  type TechnicalResponsible,
} from '@normatiza/shared';

import { AuthService } from '../../../../../core/auth/auth.service';
import { mensagemDoServidor } from '../../../../../core/http/mensagem-de-erro';
import { TeamService } from '../../../../../core/services/team.service';
import { DataTable } from '../../../../../shared/components/data-table/data-table.component';
import {
  AcaoVazia,
  CabecalhoDaTabela,
  LinhaDaTabela,
  TituloDeGrupo,
} from '../../../../../shared/components/data-table/data-table.directives';
import { InviteFormComponent } from '../../../../../shared/components/team/invite-form.component';
import { RoleGuideComponent } from '../../../../../shared/components/team/role-guide.component';
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
    DatePipe,
    Button,
    Dialog,
    Message,
    DataTable,
    CabecalhoDaTabela,
    LinhaDaTabela,
    AcaoVazia,
    TituloDeGrupo,
    InviteFormComponent,
    RoleGuideComponent,
    RoleEditorComponent,
  ],
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
  readonly nomeDaConsultoria = signal('');
  readonly responsaveisTecnicos = signal<TechnicalResponsible[]>([]);
  readonly carregando = signal(false);
  readonly erro = signal<string | null>(null);
  readonly aviso = signal<string | null>(null);

  readonly convidando = signal(false);
  readonly editando = signal<CompanyMember | null>(null);
  readonly removendo = signal<CompanyMember | null>(null);

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
  readonly membrosAgrupados = computed(() =>
    [...this.membros()].sort(
      (a, b) => this.ordemDaOrigem.indexOf(a.origin) - this.ordemDaOrigem.indexOf(b.origin),
    ),
  );

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
