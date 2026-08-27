import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import { COMPANY_SCOPED_ROLES, ROLE_LABEL, memberOrigin } from '@normatiza/shared';
import type {
  CompanyMember,
  Role,
  TeamListQuery,
  TeamMember,
  UpdateMembershipRequest,
} from '@normatiza/shared';

import { AuditAction, AuditService } from '../audit/audit.service';
import { PermissionService, SessionScope } from '../authorization/permission.service';
import { PrismaService } from '../prisma/prisma.service';
import { MemberPolicyService, TargetMember } from './member-policy.service';

/** O que as duas listagens precisam carregar do banco para decidir e projetar. */
const COM_TUDO_QUE_A_ALÇADA_PEDE = {
  memberships: { include: { company: true } },
  invitedBy: { select: { id: true, name: true } },
  succeededBy: { select: { id: true, name: true } },
  invitation: true,
} as const;

/**
 * As duas listagens de equipe e as mutações de vínculo.
 *
 * Duas projeções, e não uma filtrada: a da empresa omite o escopo da pessoa de
 * propósito (D15). Um `companyIds` a mais ali contaria ao Gestor da BRF que a
 * consultoria dele também atende a Seara — vazamento de Contexto 1 para dentro
 * do Contexto 2 ([03 §1](../../../../docs/produto/03_navegacao_e_telas.md)).
 */
@Injectable()
export class TeamService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly permissions: PermissionService,
    private readonly policy: MemberPolicyService,
    private readonly audit: AuditService,
  ) {}

  /** Contexto 1 — as pessoas da conta, dentro do escopo de quem pergunta. */
  async listAccountTeam(actor: SessionScope, filtros: TeamListQuery = {}): Promise<TeamMember[]> {
    const minhasEmpresas = this.permissions.companiesInScope(actor);

    if (filtros.companyId && !minhasEmpresas.includes(filtros.companyId)) {
      // Pedir uma empresa fora da carteira não é erro de permissão a explicar:
      // para quem está de fora, ela não existe.
      throw new NotFoundException();
    }

    const empresas = filtros.companyId ? [filtros.companyId] : minhasEmpresas;

    const pessoas = await this.prisma.user.findMany({
      where: {
        accountId: actor.accountId,
        status: filtros.status,
        // Vínculo inativo continua contando para **aparecer** na lista: quem foi
        // desligado precisa ser visível, com o status dizendo o que houve.
        memberships: {
          some: {
            companyId: { in: empresas },
            ...(filtros.role ? { roles: { has: filtros.role }, isActive: true } : {}),
          },
        },
      },
      include: COM_TUDO_QUE_A_ALÇADA_PEDE,
      orderBy: { name: 'asc' },
    });

    const conta = await this.prisma.account.findUniqueOrThrow({
      where: { id: actor.accountId },
      select: { ownerUserId: true },
    });

    return pessoas.map((pessoa) => {
      // A alçada olha os vínculos **todos** — desligar depende de alcançar todas
      // as empresas da pessoa, inclusive as que quem pergunta não enxerga.
      const alvo = paraAlvo(pessoa, conta.ownerUserId);

      return {
        id: pessoa.id,
        name: pessoa.name,
        email: pessoa.email,
        phone: pessoa.phone ?? undefined,
        jobTitle: pessoa.jobTitle ?? undefined,
        status: pessoa.status,
        // A projeção, porém, mostra só o que cabe no escopo de quem pergunta.
        memberships: pessoa.memberships
          .filter((v) => v.isActive && empresas.includes(v.companyId))
          .map((v) => ({
            id: v.id,
            companyId: v.companyId,
            company: resumoDaEmpresa(v.company),
            roles: v.roles,
            executorType: v.executorType ?? undefined,
            isActive: v.isActive,
          })),
        invitedBy: pessoa.invitedBy ?? undefined,
        lastAccessAt: pessoa.lastAccessAt?.toISOString(),
        disabledAt: pessoa.disabledAt?.toISOString(),
        succeededBy: pessoa.succeededBy ?? undefined,
        invitation: convitePendente(pessoa.invitation),
        isAccountOwner: alvo.isAccountOwner,
        actions: this.policy.actionsForAccount(actor, alvo),
      };
    });
  }

  /** Contexto 2 — quem tem acesso a esta empresa, e nada além disso. */
  async listCompanyMembers(actor: SessionScope, companyId: string): Promise<CompanyMember[]> {
    if (!this.permissions.canAccessCompany(actor, companyId)) {
      throw new NotFoundException();
    }

    const vínculos = await this.prisma.membership.findMany({
      where: { companyId, accountId: actor.accountId, isActive: true },
      include: { user: { include: COM_TUDO_QUE_A_ALÇADA_PEDE } },
      orderBy: { user: { name: 'asc' } },
    });

    const conta = await this.prisma.account.findUniqueOrThrow({
      where: { id: actor.accountId },
      select: { ownerUserId: true },
    });

    return vínculos.map((vínculo) => {
      const pessoa = vínculo.user;
      const alvo = paraAlvo(pessoa, conta.ownerUserId);

      // Nada aqui nomeia outra empresa nem a conta. É o D15 na forma do objeto.
      return {
        id: pessoa.id,
        membershipId: vínculo.id,
        name: pessoa.name,
        email: pessoa.email,
        jobTitle: pessoa.jobTitle ?? undefined,
        roles: vínculo.roles,
        executorType: vínculo.executorType ?? undefined,
        origin: memberOrigin(vínculo.roles, vínculo.executorType ?? undefined),
        status: pessoa.status,
        lastAccessAt: pessoa.lastAccessAt?.toISOString(),
        invitation: convitePendente(pessoa.invitation),
        actions: this.policy.actionsForCompany(actor, alvo, companyId),
      };
    });
  }

  /**
   * Troca o conjunto de papéis de um vínculo.
   *
   * O conjunto chega inteiro, não como delta: um "adicione Diretor" concorrente
   * com um "remova Gestor" deixaria o resultado dependendo da ordem de chegada.
   */
  async updateMembershipRoles(
    actor: SessionScope,
    membershipId: string,
    dto: UpdateMembershipRequest,
  ): Promise<void> {
    const { vínculo, alvo } = await this.carregarVínculo(actor, membershipId);

    this.policy.assertCanChangeRoles(actor, alvo, vínculo.companyId, dto.roles);
    await this.assertPapelDeEmpresaÚnico(alvo, vínculo.companyId, dto.roles);

    await this.prisma.membership.update({
      where: { id: vínculo.id },
      data: { roles: dto.roles, executorType: dto.executorType ?? vínculo.executorType },
    });

    await this.audit.record({
      action: AuditAction.MEMBERSHIP_ROLE_CHANGED,
      entityType: 'Membership',
      entityId: vínculo.id,
      accountId: actor.accountId,
      actorUserId: actor.userId,
      before: { roles: vínculo.roles },
      after: { roles: dto.roles },
    });
  }

  /** Encerra o vínculo com **aquela** empresa. Não toca no acesso à conta (D8). */
  async removeFromCompany(actor: SessionScope, membershipId: string): Promise<void> {
    const { vínculo, alvo } = await this.carregarVínculo(actor, membershipId);

    this.policy.assertCanRemoveFromCompany(actor, alvo, vínculo.companyId);
    await this.assertNãoDeixaAEmpresaÓrfã(vínculo);

    await this.prisma.membership.update({
      where: { id: vínculo.id },
      data: { isActive: false },
    });

    await this.audit.record({
      action: AuditAction.MEMBERSHIP_REMOVED,
      entityType: 'Membership',
      entityId: vínculo.id,
      accountId: actor.accountId,
      actorUserId: actor.userId,
      before: { roles: vínculo.roles, companyId: vínculo.companyId },
    });
  }

  // ── Invariantes que o usuário não pode ler como erro de banco ──────────────

  /**
   * Papel de escopo-empresa vale em **um** vínculo ativo só, e quem garante isso
   * é um índice parcial do Postgres. Deixar o banco recusar produziria uma
   * mensagem de constraint na tela — o §7 do plano chama isso de falha de
   * desenho, e é.
   */
  private async assertPapelDeEmpresaÚnico(
    alvo: TargetMember,
    companyId: string,
    novosPapéis: readonly Role[],
  ): Promise<void> {
    const deEmpresa = novosPapéis.filter((p) => COMPANY_SCOPED_ROLES.includes(p));
    if (deEmpresa.length === 0) return;

    const conflito = alvo.memberships.find(
      (v) =>
        v.isActive &&
        v.companyId !== companyId &&
        v.roles.some((p) => COMPANY_SCOPED_ROLES.includes(p)),
    );

    if (conflito) {
      const jáÉ = conflito.roles
        .filter((p) => COMPANY_SCOPED_ROLES.includes(p))
        .map((p) => ROLE_LABEL[p])
        .join(' e ');

      const verbo = deEmpresa.length > 1 ? 'valem' : 'vale';

      throw new BadRequestException(
        `${nomesDePapéis(deEmpresa)} ${verbo} em uma empresa só, e esta pessoa já é ` +
          `${jáÉ} em outra empresa. Remova o vínculo anterior antes.`,
      );
    }
  }

  /**
   * Remover da empresa não pede sucessor — mas tirar o último Gestor por aqui
   * produziria o que D4 proíbe fazer pela porta da frente. A recusa aponta o
   * caminho certo em vez de simplesmente barrar (D18).
   */
  private async assertNãoDeixaAEmpresaÓrfã(vínculo: {
    id: string;
    companyId: string;
    roles: Role[];
  }): Promise<void> {
    const emRisco = vínculo.roles.filter((p) => COMPANY_SCOPED_ROLES.includes(p));
    if (emRisco.length === 0) return;

    for (const papel of emRisco) {
      const outros = await this.prisma.membership.count({
        where: {
          companyId: vínculo.companyId,
          isActive: true,
          roles: { has: papel },
          id: { not: vínculo.id },
        },
      });

      if (outros === 0) {
        throw new BadRequestException(
          `Esta pessoa é a única com o papel de ${ROLE_LABEL[papel]} nesta empresa. ` +
            'Desligue-a da conta escolhendo um sucessor, ou promova alguém antes.',
        );
      }
    }
  }

  private async carregarVínculo(actor: SessionScope, membershipId: string) {
    const vínculo = await this.prisma.membership.findUnique({
      where: { id: membershipId },
      include: { user: { include: { memberships: true } }, account: true },
    });

    // Vínculo de outra conta não é "proibido": para quem está de fora, não existe.
    if (!vínculo || vínculo.accountId !== actor.accountId) {
      throw new NotFoundException();
    }

    return { vínculo, alvo: paraAlvo(vínculo.user, vínculo.account.ownerUserId) };
  }
}

// ── Projeções ────────────────────────────────────────────────────────────────

interface PessoaComVínculos {
  id: string;
  status: TargetMember['status'];
  memberships: { companyId: string; roles: Role[]; isActive: boolean }[];
}

function paraAlvo(pessoa: PessoaComVínculos, ownerUserId: string | null): TargetMember {
  return {
    userId: pessoa.id,
    status: pessoa.status,
    isAccountOwner: ownerUserId === pessoa.id,
    memberships: pessoa.memberships.map((v) => ({
      companyId: v.companyId,
      roles: v.roles,
      isActive: v.isActive,
    })),
  };
}

function resumoDaEmpresa(company: {
  id: string;
  tradeName: string;
  corporateName: string;
  isActive: boolean;
}) {
  return {
    id: company.id,
    tradeName: company.tradeName,
    corporateName: company.corporateName,
    isActive: company.isActive,
  };
}

function convitePendente(convite: { id: string; status: string; expiresAt: Date } | null) {
  if (!convite || convite.status !== 'PENDING') return undefined;
  return { id: convite.id, expiresAt: convite.expiresAt.toISOString() };
}

function nomesDePapéis(papéis: readonly Role[]): string {
  return papéis.map((p) => ROLE_LABEL[p]).join(', ');
}
