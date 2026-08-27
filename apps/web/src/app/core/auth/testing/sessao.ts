import type { LoginResponse, MembershipWithCompany, Role, SessionUser } from '@normatiza/shared';

/**
 * O mesmo elenco da documentação, do tamanho que o front precisa: Marcos é
 * Gestor da BRF, e a Seara existe para provar que ele não a enxerga.
 */

export const BRF = {
  id: 'company-brf',
  tradeName: 'BRF',
  corporateName: 'BRF S.A.',
  isActive: true,
};

export const SEARA = {
  id: 'company-seara',
  tradeName: 'Seara',
  corporateName: 'Seara Alimentos Ltda.',
  isActive: true,
};

export function vínculo(
  companyId: string,
  roles: Role[],
  over: Partial<MembershipWithCompany> = {},
): MembershipWithCompany {
  return {
    id: `m-${companyId}-${roles.join('-')}`,
    accountId: 'acc-normatiza',
    userId: 'u-1',
    companyId,
    roles,
    isActive: true,
    company: companyId === BRF.id ? BRF : SEARA,
    ...over,
  };
}

export function sessão(
  memberships: MembershipWithCompany[] = [vínculo(BRF.id, ['MANAGER'])],
  isPlatformAdmin = false,
  /** Titular da conta — `Account.ownerUserId` apontando para a própria pessoa. */
  éDono = false,
): SessionUser {
  return {
    isPlatformAdmin,
    user: {
      id: 'u-1',
      accountId: 'acc-normatiza',
      name: 'Marcos',
      email: 'marcos@brf.com',
      status: 'ACTIVE',
    },
    account: {
      id: 'acc-normatiza',
      name: 'Normatiza',
      document: '11.111.111/0001-11',
      status: 'ACTIVE',
      ownerUserId: éDono ? 'u-1' : 'outra-pessoa',
    },
    memberships,
  };
}

export function respostaDeLogin(over: Partial<LoginResponse> = {}): LoginResponse {
  return {
    accessToken: 'access.jwt.1',
    expiresIn: 900,
    session: sessão(),
    ...over,
  };
}
