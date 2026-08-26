import { ForbiddenException, Injectable, NotFoundException } from '@nestjs/common';
import { canInvite } from '@normatiza/shared';
import type { Membership, Role } from '@normatiza/shared';

/**
 * O escopo de quem está fazendo a requisição: a identidade, a conta e os
 * vínculos ativos. Montado uma vez por requisição a partir do token.
 */
export interface SessionScope {
  userId: string;
  accountId: string;
  memberships: Membership[];
}

/** Qualquer coisa que pertença a uma conta — ou seja, tudo. */
export interface AccountOwned {
  accountId: string;
}

/**
 * Responde "pode?" na dimensão de **papel e escopo**.
 *
 * A autorização do sistema é bidimensional — papel × etapa. A dimensão de etapa
 * pertence à máquina de estados do plano de ação e entra com ela; aqui só existe
 * a primeira.
 */
@Injectable()
export class PermissionService {
  /** A união dos papéis do vínculo com aquela empresa. Vazio se não há vínculo. */
  effectiveRoles(scope: SessionScope, companyId: string): Role[] {
    const papéis = new Set<Role>();

    for (const vínculo of this.vínculosAtivos(scope)) {
      if (vínculo.companyId !== companyId) continue;
      for (const papel of vínculo.roles) papéis.add(papel);
    }

    return [...papéis];
  }

  /** As empresas que a pessoa alcança. Uma, para papéis do lado cliente; a carteira, para a consultoria. */
  companiesInScope(scope: SessionScope): string[] {
    return [...new Set(this.vínculosAtivos(scope).map((v) => v.companyId))];
  }

  canAccessCompany(scope: SessionScope, companyId: string): boolean {
    return this.vínculosAtivos(scope).some((v) => v.companyId === companyId);
  }

  /**
   * Verdadeiro apenas para quem enxerga a empresa como um todo — inventário,
   * análises, plano de ação. O Executor tem vínculo com a empresa mas **não**
   * tem acesso em nível de empresa: seu escopo são as próprias tarefas.
   */
  canReadCompanyData(scope: SessionScope, companyId: string): boolean {
    // Basta um papel que não seja `EXECUTOR`: quem acumula executor com outra
    // função enxerga pela outra função. Executor não é uma marca na pessoa, é um
    // papel no vínculo.
    return this.effectiveRoles(scope, companyId).some((papel) => papel !== 'EXECUTOR');
  }

  /**
   * O limite absoluto. Lança quando o recurso é de outra conta — e lança como
   * "não existe", não como "não pode": confirmar a existência de um dado de
   * outra consultoria já é vazamento.
   */
  assertSameAccount(scope: SessionScope, resource: AccountOwned): void {
    if (resource.accountId !== scope.accountId) {
      throw new NotFoundException();
    }
  }

  /** Teto de papel: a tabela "quem convida quem". */
  canInviteRole(scope: SessionScope, target: Role): boolean {
    return canInvite(this.todosOsPapéis(scope), target);
  }

  /** Teto de escopo: ninguém oferece empresa que não tem. */
  assertInviteWithinScope(scope: SessionScope, offeredCompanyIds: string[]): void {
    const próprias = new Set(this.companiesInScope(scope));

    // O teto vale para o conjunto inteiro. Aceitar a parte válida de um convite
    // fora de escopo seria conceder acesso pela metade.
    const forasteiras = offeredCompanyIds.filter((id) => !próprias.has(id));

    if (forasteiras.length > 0) {
      throw new ForbiddenException(
        'O convite oferece empresa fora do escopo de quem convida.',
      );
    }
  }

  private vínculosAtivos(scope: SessionScope): Membership[] {
    // Vínculo desligado continua no banco — nada é apagado fisicamente — mas não
    // concede nada.
    return scope.memberships.filter((v) => v.isActive);
  }

  private todosOsPapéis(scope: SessionScope): Role[] {
    return [...new Set(this.vínculosAtivos(scope).flatMap((v) => v.roles))];
  }
}
