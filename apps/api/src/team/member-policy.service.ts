import { Injectable } from '@nestjs/common';
import type { MemberActions, Role, UserStatus } from '@normatiza/shared';

import { SessionScope } from '../authorization/permission.service';

/**
 * A pessoa sobre quem se pergunta "posso?".
 *
 * Traz os vínculos **todos**, inclusive os de empresas que quem pergunta não
 * alcança — é justamente essa comparação que decide o desligamento da conta.
 * Nada disto atravessa para o contrato de rede: `CompanyMember` não carrega
 * escopo (D15), e é o servidor que responde por ele.
 */
export interface TargetMember {
  userId: string;
  status: UserStatus;
  isAccountOwner: boolean;
  memberships: { companyId: string; roles: Role[]; isActive: boolean }[];
}

/**
 * Responde o que **quem olha** pode fazer com **quem é olhado** (D13).
 *
 * Existe separada dos serviços que a usam porque a mesma resposta precisa valer
 * em três momentos: montando a lista, montando o *preview* do desligamento e
 * validando a mutação. Três cópias divergiriam, e a que divergisse para o lado
 * permissivo viraria uma brecha.
 *
 * É pura de propósito — não fala com o banco. O chamador carrega os dados.
 */
@Injectable()
export class MemberPolicyService {
  /** A visão da Equipe da conta: alcança o ciclo de vida inteiro. */
  actionsForAccount(actor: SessionScope, target: TargetMember): MemberActions {
    throw new Error('não implementado');
  }

  /**
   * A visão da Equipe da Empresa. `disableFromAccount` é **sempre** falso aqui:
   * não é falta de alçada de quem olha, é ato que esta tela não pratica (D8).
   */
  actionsForCompany(
    actor: SessionScope,
    target: TargetMember,
    companyId: string,
  ): MemberActions {
    throw new Error('não implementado');
  }

  /** Lança quando quem pede não pode mexer no vínculo daquela pessoa naquela empresa. */
  assertCanChangeRoles(
    actor: SessionScope,
    target: TargetMember,
    companyId: string,
    novosPapéis: readonly Role[],
  ): void {
    throw new Error('não implementado');
  }

  assertCanRemoveFromCompany(
    actor: SessionScope,
    target: TargetMember,
    companyId: string,
  ): void {
    throw new Error('não implementado');
  }

  assertCanDisable(actor: SessionScope, target: TargetMember): void {
    throw new Error('não implementado');
  }
}
