import { ForbiddenException } from '@nestjs/common';
import type { Role } from '@normatiza/shared';

import { MemberPolicyService, TargetMember } from './member-policy.service';
import { SessionScope } from '../authorization/permission.service';

/**
 * Quem pode mexer em quem ([01 §5](../../../../docs/produto/01_papeis_e_permissoes.md)).
 *
 * O elenco é o da documentação: a Normatiza atende BRF e Seara. Os testes falam
 * nos nomes das pessoas porque a regra é sobre relações entre pessoas — quando
 * um quebra, a mensagem já diz qual delas deixou de valer.
 */

const CONTA = 'acc-normatiza';
const BRF = 'company-brf';
const SEARA = 'company-seara';

function escopo(
  userId: string,
  vínculos: { companyId: string; roles: Role[]; isActive?: boolean }[],
): SessionScope {
  return {
    userId,
    accountId: CONTA,
    memberships: vínculos.map((v, i) => ({
      id: `m-${userId}-${i}`,
      accountId: CONTA,
      userId,
      companyId: v.companyId,
      roles: v.roles,
      isActive: v.isActive ?? true,
    })),
  };
}

function alvo(
  userId: string,
  vínculos: { companyId: string; roles: Role[]; isActive?: boolean }[],
  over: Partial<TargetMember> = {},
): TargetMember {
  return {
    userId,
    status: 'ACTIVE',
    isAccountOwner: false,
    memberships: vínculos.map((v) => ({
      companyId: v.companyId,
      roles: v.roles,
      isActive: v.isActive ?? true,
    })),
    ...over,
  };
}

// ── O elenco ─────────────────────────────────────────────────────────────────

const josué = escopo('u-josue', [
  { companyId: BRF, roles: ['LEAD_ENGINEER'] },
  { companyId: SEARA, roles: ['LEAD_ENGINEER'] },
]);
const carla = escopo('u-carla', [
  { companyId: BRF, roles: ['CONSULTANT_ENGINEER'] },
  { companyId: SEARA, roles: ['CONSULTANT_ENGINEER'] },
]);
const marcos = escopo('u-marcos', [{ companyId: BRF, roles: ['MANAGER'] }]);
const antonio = escopo('u-antonio', [{ companyId: BRF, roles: ['CLIENT_ENGINEER'] }]);
const débora = escopo('u-debora', [{ companyId: BRF, roles: ['DIRECTOR'] }]);

const alvoJosué = alvo(
  'u-josue',
  [
    { companyId: BRF, roles: ['LEAD_ENGINEER'] },
    { companyId: SEARA, roles: ['LEAD_ENGINEER'] },
  ],
  { isAccountOwner: true },
);
const alvoCarla = alvo('u-carla', [
  { companyId: BRF, roles: ['CONSULTANT_ENGINEER'] },
  { companyId: SEARA, roles: ['CONSULTANT_ENGINEER'] },
]);
const alvoFernando = alvo('u-fernando', [{ companyId: BRF, roles: ['TECHNICIAN'] }]);
const alvoMarcos = alvo('u-marcos', [{ companyId: BRF, roles: ['MANAGER'] }]);
const alvoRafael = alvo('u-rafael', [{ companyId: BRF, roles: ['EXECUTOR'] }]);
const alvoPaulo = alvo('u-paulo', [
  { companyId: BRF, roles: ['EXECUTOR'] },
  { companyId: SEARA, roles: ['EXECUTOR'] },
]);

describe('MemberPolicyService', () => {
  let policy: MemberPolicyService;

  beforeEach(() => {
    policy = new MemberPolicyService();
  });

  describe('trocar o papel de alguém', () => {
    it('deve permitir a quem poderia ter convidado aquela pessoa (D3)', async () => {
      // A alçada para promover é a mesma de convidar. Sem isso seria uma
      // segunda tabela de permissão para manter em dia com a primeira.
      expect(policy.actionsForAccount(josué, alvoMarcos).changeRoles).toBe(true);
    });

    it('deve recusar papel acima do teto de quem promove', () => {
      // A Carla convida Técnico e mais nada. Promover alguém a Gestor seria
      // conceder o que ela mesma não tem como oferecer.
      expect(() =>
        policy.assertCanChangeRoles(carla, alvoFernando, BRF, ['MANAGER']),
      ).toThrow(ForbiddenException);
    });

    it('não deve deixar o cliente mexer em quem é da consultoria', () => {
      // O Marcos vê que a Carla atende a BRF; ele não a gerencia ([03 §4.5]).
      // A consultoria está acima dele, não ao lado.
      const ações = policy.actionsForCompany(marcos, alvoCarla, BRF);

      expect(ações.changeRoles).toBe(false);
      expect(ações.removeFromCompany).toBe(false);
    });

    it('não deve deixar ninguém mudar o próprio papel (D16)', () => {
      // `CAN_INVITE` impede subir acima do próprio teto, mas não impede o
      // Gestor de se dar Engenheiro do Cliente. Alçada que a pessoa se concede
      // sozinha deixa de ser alçada.
      expect(policy.actionsForAccount(marcos, alvoMarcos).changeRoles).toBe(false);
      expect(() =>
        policy.assertCanChangeRoles(marcos, alvoMarcos, BRF, ['MANAGER', 'CLIENT_ENGINEER']),
      ).toThrow(ForbiddenException);
    });

    it('deve recusar quem não tem alçada de convite nenhuma', () => {
      // A Débora é Diretora: vê tudo da BRF e não concede nada a ninguém.
      expect(policy.actionsForAccount(débora, alvoRafael).changeRoles).toBe(false);
    });

    it('deve exigir alçada na empresa do vínculo, não em qualquer uma', () => {
      // Um Engenheiro Responsável que só atende a BRF não manda na Seara.
      const sóNaBrf = escopo('u-outro-lead', [{ companyId: BRF, roles: ['LEAD_ENGINEER'] }]);

      expect(() =>
        policy.assertCanChangeRoles(sóNaBrf, alvoPaulo, SEARA, ['EXECUTOR']),
      ).toThrow(ForbiddenException);
    });
  });

  describe('remover da empresa (D8)', () => {
    it('deve permitir a quem administra aquela empresa', () => {
      expect(policy.actionsForCompany(marcos, alvoRafael, BRF).removeFromCompany).toBe(true);
    });

    it('deve permitir ao Engenheiro do Cliente tirar o executor que ele convidaria', () => {
      expect(policy.actionsForCompany(antonio, alvoRafael, BRF).removeFromCompany).toBe(true);
    });

    it('não deve permitir ao Diretor, que não concede nada', () => {
      expect(policy.actionsForCompany(débora, alvoRafael, BRF).removeFromCompany).toBe(false);
    });

    it('não deve deixar ninguém remover a si mesmo', () => {
      expect(policy.actionsForCompany(marcos, alvoMarcos, BRF).removeFromCompany).toBe(false);
    });
  });

  describe('desligar da conta (D8)', () => {
    it('deve ser do lado consultoria, e só dele', () => {
      // [01 §5] fecha a alçada: o Gestor da BRF tira alguém da BRF, mas não
      // apaga essa pessoa da consultoria que a atende.
      expect(policy.actionsForAccount(josué, alvoRafael).disableFromAccount).toBe(true);
      expect(policy.actionsForAccount(marcos, alvoRafael).disableFromAccount).toBe(false);
    });

    it('deve valer para quem não convidou a pessoa (D5)', () => {
      // A alçada é papel e escopo, nunca a árvore de convites: senão o executor
      // convidado por quem já saiu ficaria ativo e órfão, sem ninguém para
      // encerrá-lo.
      expect(policy.actionsForAccount(josué, alvoPaulo).disableFromAccount).toBe(true);
    });

    it('deve exigir alcançar **todas** as empresas da pessoa', () => {
      // Desligar da conta derruba todos os vínculos. Quem só enxerga a BRF não
      // pode encerrar, de tabela, o acesso do Paulo à Seara.
      const sóNaBrf = escopo('u-outro-lead', [{ companyId: BRF, roles: ['LEAD_ENGINEER'] }]);

      expect(policy.actionsForAccount(sóNaBrf, alvoPaulo).disableFromAccount).toBe(false);
      expect(() => policy.assertCanDisable(sóNaBrf, alvoPaulo)).toThrow(ForbiddenException);
    });

    it('não deve desligar o titular da conta — por ninguém (D12)', () => {
      // Não é alçada insuficiente: a consultoria sem dono não tem quem convide,
      // administre ou responda por ela. Trocar o titular é transferência de
      // titularidade, com fluxo próprio.
      expect(policy.actionsForAccount(josué, alvoJosué).disableFromAccount).toBe(false);
      expect(() => policy.assertCanDisable(josué, alvoJosué)).toThrow(ForbiddenException);
    });

    it('não deve deixar ninguém se desligar', () => {
      expect(policy.actionsForAccount(carla, alvoCarla).disableFromAccount).toBe(false);
    });

    it('não deve oferecer o desligamento de quem já está desligado', () => {
      const jáSaiu = alvo('u-ex', [{ companyId: BRF, roles: ['EXECUTOR'], isActive: false }], {
        status: 'DISABLED',
      });

      expect(policy.actionsForAccount(josué, jáSaiu).disableFromAccount).toBe(false);
    });

    it('nunca deve aparecer na tela da empresa (D8)', () => {
      // Não é falta de alçada de quem olha — o Josué tem. É ato que aquela tela
      // não pratica, e oferecê-lo ali apagaria a distinção entre os dois.
      expect(policy.actionsForCompany(josué, alvoRafael, BRF).disableFromAccount).toBe(false);
    });
  });

  describe('convite pendente', () => {
    const convidado = alvo('u-novo', [{ companyId: BRF, roles: ['EXECUTOR'] }], {
      status: 'INVITED',
    });

    it('deve oferecer reenviar e revogar a quem tem a alçada', () => {
      const ações = policy.actionsForAccount(marcos, convidado);

      expect(ações.resendInvitation).toBe(true);
      expect(ações.revokeInvitation).toBe(true);
    });

    it('não deve oferecer nada disso para quem já entrou', () => {
      // Reenviar convite de quem já aceitou não tem o que significar.
      const ações = policy.actionsForAccount(marcos, alvoRafael);

      expect(ações.resendInvitation).toBe(false);
      expect(ações.revokeInvitation).toBe(false);
    });

    it('não deve oferecer a quem não teria convidado aquela pessoa', () => {
      expect(policy.actionsForAccount(débora, convidado).resendInvitation).toBe(false);
    });
  });
});
