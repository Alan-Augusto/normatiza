import { Injectable } from '@nestjs/common';
import type {
  CompanyMember,
  TeamListQuery,
  TeamMember,
  UpdateMembershipRequest,
} from '@normatiza/shared';

import { AuditService } from '../audit/audit.service';
import { PermissionService, SessionScope } from '../authorization/permission.service';
import { PrismaService } from '../prisma/prisma.service';
import { MemberPolicyService } from './member-policy.service';

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
    throw new Error('não implementado');
  }

  /** Contexto 2 — quem tem acesso a esta empresa, e nada além disso. */
  async listCompanyMembers(actor: SessionScope, companyId: string): Promise<CompanyMember[]> {
    throw new Error('não implementado');
  }

  /**
   * Troca o conjunto de papéis de um vínculo.
   *
   * Precisa antecipar a invariante do índice parcial: papel de escopo-empresa
   * vale em **um** vínculo ativo só. O banco recusa o segundo — o que não pode
   * chegar ao usuário como erro de constraint.
   */
  async updateMembershipRoles(
    actor: SessionScope,
    membershipId: string,
    dto: UpdateMembershipRequest,
  ): Promise<void> {
    throw new Error('não implementado');
  }

  /** Encerra o vínculo com **aquela** empresa. Não toca no acesso à conta (D8). */
  async removeFromCompany(actor: SessionScope, membershipId: string): Promise<void> {
    throw new Error('não implementado');
  }
}
