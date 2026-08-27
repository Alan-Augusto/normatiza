import { ForbiddenException, Injectable } from '@nestjs/common';
import { ROLE_SIDE, canInvite, invitableRoles } from '@normatiza/shared';
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
    // Basta poder mexer em um vínculo: a tela edita um de cada vez.
    const alcançaAlgum = this.vínculosAtivos(target).some((v) =>
      this.temAlçadaSobre(actor, target, v.companyId),
    );

    return {
      changeRoles: alcançaAlgum,
      removeFromCompany: alcançaAlgum,
      disableFromAccount: this.podeDesligar(actor, target),
      resendInvitation: alcançaAlgum && target.status === 'INVITED',
      revokeInvitation: alcançaAlgum && target.status === 'INVITED',
    };
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
    const alcança = this.temAlçadaSobre(actor, target, companyId);

    return {
      changeRoles: alcança,
      removeFromCompany: alcança,
      disableFromAccount: false,
      resendInvitation: alcança && target.status === 'INVITED',
      revokeInvitation: alcança && target.status === 'INVITED',
    };
  }

  /** Lança quando quem pede não pode mexer no vínculo daquela pessoa naquela empresa. */
  assertCanChangeRoles(
    actor: SessionScope,
    target: TargetMember,
    companyId: string,
    novosPapéis: readonly Role[],
  ): void {
    this.assertAlçadaSobre(actor, target, companyId);

    const meus = this.papéisEm(actor, companyId);
    for (const papel of novosPapéis) {
      if (!canInvite(meus, papel)) {
        throw new ForbiddenException(`Você não pode conceder o papel ${papel}.`);
      }
    }
  }

  assertCanRemoveFromCompany(
    actor: SessionScope,
    target: TargetMember,
    companyId: string,
  ): void {
    this.assertAlçadaSobre(actor, target, companyId);
  }

  assertCanDisable(actor: SessionScope, target: TargetMember): void {
    if (target.isAccountOwner) {
      // Não é alçada insuficiente: a consultoria sem dono não tem quem convide,
      // administre ou responda por ela ([01 §5]). Trocar o titular é
      // transferência de titularidade, com fluxo próprio.
      throw new ForbiddenException(
        'O titular da conta não pode ser desligado. Transfira a titularidade antes.',
      );
    }

    if (!this.podeDesligar(actor, target)) {
      throw new ForbiddenException(
        'Você não tem alçada para desligar esta pessoa da conta.',
      );
    }
  }

  // ── Os fundamentos ─────────────────────────────────────────────────────────

  /**
   * A alçada sobre o vínculo de alguém numa empresa: estar lá, poder conceder
   * alguma coisa lá, e que os papéis atuais da pessoa caibam no próprio teto.
   *
   * O último ponto é o que mantém a consultoria fora do alcance do cliente: o
   * Marcos vê que a Carla atende a BRF, mas Engenheiro da Consultoria não está
   * entre os papéis que ele concede, logo ele não mexe nela ([03 §4.5]).
   */
  private temAlçadaSobre(
    actor: SessionScope,
    target: TargetMember,
    companyId: string,
  ): boolean {
    // Mexer no próprio vínculo é pedido a quem está acima (D16).
    if (actor.userId === target.userId) return false;

    const meus = this.papéisEm(actor, companyId);
    if (invitableRoles(meus).length === 0) return false;

    const vínculo = target.memberships.find((v) => v.companyId === companyId && v.isActive);
    if (!vínculo) return false;

    return vínculo.roles.every((papel) => canInvite(meus, papel));
  }

  private assertAlçadaSobre(
    actor: SessionScope,
    target: TargetMember,
    companyId: string,
  ): void {
    if (actor.userId === target.userId) {
      throw new ForbiddenException(
        'Mudanças no próprio vínculo são feitas por quem tem alçada sobre você.',
      );
    }

    if (!this.temAlçadaSobre(actor, target, companyId)) {
      throw new ForbiddenException('Você não tem alçada sobre esta pessoa nesta empresa.');
    }
  }

  private podeDesligar(actor: SessionScope, target: TargetMember): boolean {
    if (actor.userId === target.userId) return false;
    if (target.isAccountOwner) return false;
    if (target.status === 'DISABLED') return false;

    // "Desligar da conta: só o lado consultoria" ([01 §5]). O Gestor da BRF
    // tira alguém da BRF; ele não apaga essa pessoa da Normatiza.
    if (!this.éDaConsultoria(actor)) return false;

    const vínculos = this.vínculosAtivos(target);
    if (vínculos.length === 0) {
      // Convidado que ainda não tem vínculo ativo: basta ser da consultoria.
      return true;
    }

    // Desligar derruba **todos** os vínculos. Quem só enxerga a BRF não pode
    // encerrar, de tabela, o acesso da pessoa à Seara.
    return vínculos.every((v) => this.temAlçadaSobre(actor, target, v.companyId));
  }

  private éDaConsultoria(actor: SessionScope): boolean {
    return actor.memberships
      .filter((v) => v.isActive)
      .some((v) => v.roles.some((papel) => ROLE_SIDE[papel] === 'CONSULTANCY'));
  }

  private papéisEm(actor: SessionScope, companyId: string): Role[] {
    const papéis = new Set<Role>();

    for (const vínculo of actor.memberships) {
      if (!vínculo.isActive || vínculo.companyId !== companyId) continue;
      for (const papel of vínculo.roles) papéis.add(papel);
    }

    return [...papéis];
  }

  private vínculosAtivos(target: TargetMember) {
    return target.memberships.filter((v) => v.isActive);
  }
}

