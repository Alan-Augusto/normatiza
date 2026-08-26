import { ForbiddenException, NotFoundException } from '@nestjs/common';
import type { Membership, Role } from '@normatiza/shared';

import { PermissionService, SessionScope } from './permission.service';

const NORMATIZA = 'acc-normatiza';
const RIVAL = 'acc-rival';
const BRF = 'brf';
const SEARA = 'seara';

function vínculo(over: Partial<Membership> & Pick<Membership, 'companyId' | 'roles'>): Membership {
  return {
    id: `m-${over.companyId}-${over.roles.join('-')}`,
    accountId: NORMATIZA,
    userId: 'u-1',
    isActive: true,
    ...over,
  } as Membership;
}

function escopo(memberships: Membership[], over: Partial<SessionScope> = {}): SessionScope {
  return { userId: 'u-1', accountId: NORMATIZA, memberships, ...over };
}

describe('PermissionService', () => {
  let service: PermissionService;

  beforeEach(() => {
    service = new PermissionService();
  });

  describe('acúmulo de papéis', () => {
    it('deve somar os papéis que a pessoa tem na mesma empresa', () => {
      // Empresa pequena: quem monta o orçamento é quem aprova.
      const antonio = escopo([vínculo({ companyId: BRF, roles: ['MANAGER', 'CLIENT_ENGINEER'] })]);

      expect(service.effectiveRoles(antonio, BRF).sort()).toEqual([
        'CLIENT_ENGINEER',
        'MANAGER',
      ]);
    });

    it('não deve conceder papel de uma empresa em outra', () => {
      const carla = escopo([
        vínculo({ companyId: BRF, roles: ['CONSULTANT_ENGINEER'] }),
        vínculo({ companyId: SEARA, roles: ['TECHNICIAN'] }),
      ]);

      expect(service.effectiveRoles(carla, SEARA)).toEqual(['TECHNICIAN']);
    });

    it('não deve conceder papel nenhum em empresa sem vínculo', () => {
      const marcos = escopo([vínculo({ companyId: BRF, roles: ['MANAGER'] })]);

      expect(service.effectiveRoles(marcos, SEARA)).toEqual([]);
    });

    it('deve ignorar vínculo inativo', () => {
      // Desligado da empresa continua no banco, mas não concede nada.
      const exFuncionário = escopo([
        vínculo({ companyId: BRF, roles: ['MANAGER'], isActive: false }),
      ]);

      expect(service.effectiveRoles(exFuncionário, BRF)).toEqual([]);
      expect(service.canAccessCompany(exFuncionário, BRF)).toBe(false);
    });
  });

  describe('carteira da consultoria × empresa única do cliente', () => {
    it('deve dar à consultoria acesso a todas as empresas da carteira', () => {
      const carla = escopo([
        vínculo({ companyId: BRF, roles: ['CONSULTANT_ENGINEER'] }),
        vínculo({ companyId: SEARA, roles: ['CONSULTANT_ENGINEER'] }),
      ]);

      expect(service.companiesInScope(carla).sort()).toEqual([BRF, SEARA]);
    });

    it('deve manter o Gestor da BRF cego para a Seara', () => {
      // A regra de escopo mais importante do sistema.
      const marcos = escopo([vínculo({ companyId: BRF, roles: ['MANAGER'] })]);

      expect(service.canAccessCompany(marcos, BRF)).toBe(true);
      expect(service.canAccessCompany(marcos, SEARA)).toBe(false);
    });
  });

  describe('isolamento entre contas', () => {
    it('deve tratar dado de outra conta como inexistente', () => {
      // "Não pode" confirmaria que existe. Para quem está de fora, não existe.
      const carla = escopo([vínculo({ companyId: BRF, roles: ['CONSULTANT_ENGINEER'] })]);

      expect(() => service.assertSameAccount(carla, { accountId: RIVAL })).toThrow(
        NotFoundException,
      );
    });

    it('deve deixar passar dado da própria conta', () => {
      const carla = escopo([vínculo({ companyId: BRF, roles: ['CONSULTANT_ENGINEER'] })]);

      expect(() => service.assertSameAccount(carla, { accountId: NORMATIZA })).not.toThrow();
    });

    it('não deve deixar o papel mais alto do sistema atravessar contas', () => {
      // Nem o dono da conta. Nada atravessa contas, em nenhuma hipótese.
      const josué = escopo([vínculo({ companyId: BRF, roles: ['LEAD_ENGINEER'] })]);

      expect(() => service.assertSameAccount(josué, { accountId: RIVAL })).toThrow(
        NotFoundException,
      );
    });
  });

  describe('o Executor', () => {
    const paulo = escopo([
      vínculo({ companyId: BRF, roles: ['EXECUTOR'], executorType: 'THIRD_PARTY' }),
      vínculo({ companyId: SEARA, roles: ['EXECUTOR'], executorType: 'THIRD_PARTY' }),
    ]);

    it('deve atender várias empresas da mesma conta com um login só', () => {
      expect(service.companiesInScope(paulo).sort()).toEqual([BRF, SEARA]);
    });

    it('não deve enxergar a empresa, mesmo tendo vínculo com ela', () => {
      // O escopo dele são as tarefas. Ter vínculo com a BRF não lhe dá o
      // inventário, as análises nem o plano de ação da BRF.
      expect(service.canAccessCompany(paulo, BRF)).toBe(true);
      expect(service.canReadCompanyData(paulo, BRF)).toBe(false);
    });

    it('deve enxergar a empresa quando acumula um papel que dá esse acesso', () => {
      // Rafael é eletricista da BRF e também Engenheiro do Cliente: o executor
      // não é uma marca na pessoa, é um papel no vínculo.
      const rafael = escopo([
        vínculo({ companyId: BRF, roles: ['EXECUTOR', 'CLIENT_ENGINEER'], executorType: 'INTERNAL' }),
      ]);

      expect(service.canReadCompanyData(rafael, BRF)).toBe(true);
    });

    it('não deve alcançar empresa que não atende', () => {
      const rafael = escopo([vínculo({ companyId: BRF, roles: ['EXECUTOR'] })]);

      expect(service.canAccessCompany(rafael, SEARA)).toBe(false);
    });
  });

  describe('teto do convite', () => {
    const josué = escopo([
      vínculo({ companyId: BRF, roles: ['LEAD_ENGINEER'] }),
      vínculo({ companyId: SEARA, roles: ['LEAD_ENGINEER'] }),
    ]);
    const marcos = escopo([vínculo({ companyId: BRF, roles: ['MANAGER'] })]);
    const antonio = escopo([vínculo({ companyId: BRF, roles: ['CLIENT_ENGINEER'] })]);
    const fernando = escopo([vínculo({ companyId: BRF, roles: ['TECHNICIAN'] })]);

    it.each<[string, SessionScope, Role, boolean]>([
      ['Engenheiro Responsável convida Gestor', josué, 'MANAGER', true],
      ['Engenheiro Responsável convida Técnico', josué, 'TECHNICIAN', true],
      ['Gestor convida Engenheiro do Cliente', marcos, 'CLIENT_ENGINEER', true],
      ['Gestor convida Executor', marcos, 'EXECUTOR', true],
      ['Gestor NÃO convida Engenheiro da Consultoria', marcos, 'CONSULTANT_ENGINEER', false],
      ['Engenheiro do Cliente convida Executor', antonio, 'EXECUTOR', true],
      ['Engenheiro do Cliente NÃO convida Gestor', antonio, 'MANAGER', false],
      ['Técnico não convida ninguém', fernando, 'EXECUTOR', false],
    ])('%s', (_rótulo, quemConvida, alvo, esperado) => {
      expect(service.canInviteRole(quemConvida, alvo)).toBe(esperado);
    });

    it('deve recusar convite para empresa fora do escopo de quem convida', () => {
      // Delegação decrescente: ninguém concede o que não tem.
      expect(() => service.assertInviteWithinScope(marcos, [SEARA])).toThrow(ForbiddenException);
    });

    it('deve recusar convite que mistura empresa própria com empresa alheia', () => {
      // O teto vale para o conjunto inteiro, não para a maioria dele.
      expect(() => service.assertInviteWithinScope(josué, [BRF, 'empresa-de-outra-conta'])).toThrow(
        ForbiddenException,
      );
    });

    it('deve aceitar convite dentro do escopo', () => {
      expect(() => service.assertInviteWithinScope(josué, [BRF, SEARA])).not.toThrow();
    });
  });
});
