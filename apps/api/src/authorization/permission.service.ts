import { Injectable } from '@nestjs/common';
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
  effectiveRoles(_scope: SessionScope, _companyId: string): Role[] {
    throw new Error('PermissionService.effectiveRoles não implementado');
  }

  /** As empresas que a pessoa alcança. Uma, para papéis do lado cliente; a carteira, para a consultoria. */
  companiesInScope(_scope: SessionScope): string[] {
    throw new Error('PermissionService.companiesInScope não implementado');
  }

  canAccessCompany(_scope: SessionScope, _companyId: string): boolean {
    throw new Error('PermissionService.canAccessCompany não implementado');
  }

  /**
   * Verdadeiro apenas para quem enxerga a empresa como um todo — inventário,
   * análises, plano de ação. O Executor tem vínculo com a empresa mas **não**
   * tem acesso em nível de empresa: seu escopo são as próprias tarefas.
   */
  canReadCompanyData(_scope: SessionScope, _companyId: string): boolean {
    throw new Error('PermissionService.canReadCompanyData não implementado');
  }

  /**
   * O limite absoluto. Lança quando o recurso é de outra conta — e lança como
   * "não existe", não como "não pode": confirmar a existência de um dado de
   * outra consultoria já é vazamento.
   */
  assertSameAccount(_scope: SessionScope, _resource: AccountOwned): void {
    throw new Error('PermissionService.assertSameAccount não implementado');
  }

  /** Teto de papel: a tabela "quem convida quem". */
  canInviteRole(_scope: SessionScope, _target: Role): boolean {
    throw new Error('PermissionService.canInviteRole não implementado');
  }

  /** Teto de escopo: ninguém oferece empresa que não tem. */
  assertInviteWithinScope(_scope: SessionScope, _offeredCompanyIds: string[]): void {
    throw new Error('PermissionService.assertInviteWithinScope não implementado');
  }
}
