import type {
  CompanyMember,
  DisableUserPreview,
  MemberActions,
  Role,
  TeamMember,
  TeamMembership,
} from '@normatiza/shared';

import { BRF, SEARA } from '../../auth/testing/sessao';

/**
 * O elenco da documentação, do tamanho que a tela de equipe precisa.
 *
 * As `actions` de cada linha vêm do servidor — aqui elas são dado de entrada,
 * como na vida real. Um teste que as recalculasse estaria provando a conta que
 * o Angular faz, e não a que o servidor manda fazer.
 */

export const NADA: MemberActions = {
  changeRoles: false,
  removeFromCompany: false,
  disableFromAccount: false,
  resendInvitation: false,
  revokeInvitation: false,
};

export const TUDO: MemberActions = {
  changeRoles: true,
  removeFromCompany: true,
  disableFromAccount: true,
  resendInvitation: false,
  revokeInvitation: false,
};

export function vínculoDe(
  companyId: string,
  roles: Role[],
  over: Partial<TeamMembership> = {},
): TeamMembership {
  return {
    id: `m-${companyId}-${roles.join('-')}`,
    companyId,
    company: companyId === BRF.id ? BRF : SEARA,
    roles,
    isActive: true,
    ...over,
  };
}

export function membro(over: Partial<TeamMember> = {}): TeamMember {
  return {
    id: 'u-x',
    name: 'Alguém',
    email: 'alguem@exemplo.com',
    status: 'ACTIVE',
    memberships: [],
    isAccountOwner: false,
    actions: NADA,
    ...over,
  };
}

/** Engenheiro Responsável e titular da conta — a linha que não se desliga (D12). */
export const josué = membro({
  id: 'u-josue',
  name: 'Josué',
  email: 'josue@normatiza.com',
  memberships: [vínculoDe(BRF.id, ['LEAD_ENGINEER']), vínculoDe(SEARA.id, ['LEAD_ENGINEER'])],
  isAccountOwner: true,
  lastAccessAt: '2026-08-20T12:00:00.000Z',
  actions: { ...TUDO, disableFromAccount: false },
});

/** Engenheira da Consultoria — convida Técnico e mais nada. */
export const carla = membro({
  id: 'u-carla',
  name: 'Carla',
  email: 'carla@normatiza.com',
  memberships: [vínculoDe(BRF.id, ['CONSULTANT_ENGINEER'])],
  invitedBy: { id: josué.id, name: 'Josué' },
  lastAccessAt: '2026-08-24T09:00:00.000Z',
  actions: TUDO,
});

/** Gestor da BRF — lado cliente, uma empresa só. */
export const marcos = membro({
  id: 'u-marcos',
  name: 'Marcos',
  email: 'marcos@brf.com',
  memberships: [vínculoDe(BRF.id, ['MANAGER'])],
  invitedBy: { id: josué.id, name: 'Josué' },
  actions: TUDO,
});

/** Convite ainda aberto — "expirado" não é status, é `expiresAt` no passado. */
export const rafael = membro({
  id: 'u-rafael',
  name: 'Rafael',
  email: 'rafael@brf.com',
  status: 'INVITED',
  memberships: [vínculoDe(BRF.id, ['EXECUTOR'])],
  invitedBy: { id: marcos.id, name: 'Marcos' },
  invitation: { id: 'inv-rafael', expiresAt: '2999-01-01T00:00:00.000Z' },
  actions: { ...NADA, resendInvitation: true, revokeInvitation: true },
});

export const conviteExpirado = membro({
  ...rafael,
  id: 'u-tiago',
  name: 'Tiago',
  email: 'tiago@brf.com',
  invitation: { id: 'inv-tiago', expiresAt: '2020-01-01T00:00:00.000Z' },
});

/** Quem já saiu: a linha continua, e diz quem herdou o que era dela (D6). */
export const desligado = membro({
  id: 'u-antigo',
  name: 'Antônio',
  email: 'antonio@brf.com',
  status: 'DISABLED',
  memberships: [],
  disabledAt: '2026-07-01T10:00:00.000Z',
  succeededBy: { id: marcos.id, name: 'Marcos' },
});

/**
 * Executor na BRF e Diretor na Seara. Existe para o conflito da invariante:
 * promovê-lo a Gestor da BRF é recusado pelo banco, porque papel de
 * escopo-empresa vale num vínculo ativo só.
 */
export const fernando = membro({
  id: 'u-fernando',
  name: 'Fernando',
  email: 'fernando@brf.com',
  memberships: [vínculoDe(BRF.id, ['EXECUTOR']), vínculoDe(SEARA.id, ['DIRECTOR'])],
  invitedBy: { id: josué.id, name: 'Josué' },
  actions: TUDO,
});

export const EQUIPE: TeamMember[] = [josué, carla, marcos, rafael, fernando, desligado];

// ─────────────────────────────────────────────────────────────────────────────
// Contexto 2 — a mesma gente, vista de dentro da BRF
// ─────────────────────────────────────────────────────────────────────────────

export function membroDaEmpresa(over: Partial<CompanyMember> = {}): CompanyMember {
  return {
    id: 'u-x',
    membershipId: 'm-x',
    name: 'Alguém',
    email: 'alguem@exemplo.com',
    roles: ['EXECUTOR'],
    origin: 'CLIENT',
    status: 'ACTIVE',
    actions: NADA,
    ...over,
  };
}

/** A consultoria aparece na lista — mas o cliente não a gerencia. */
export const carlaNaBrf = membroDaEmpresa({
  id: carla.id,
  membershipId: 'm-brf-carla',
  name: 'Carla',
  email: 'carla@normatiza.com',
  roles: ['CONSULTANT_ENGINEER'],
  origin: 'CONSULTANCY',
  actions: NADA,
});

export const marcosNaBrf = membroDaEmpresa({
  id: marcos.id,
  membershipId: 'm-brf-marcos',
  name: 'Marcos',
  email: 'marcos@brf.com',
  roles: ['MANAGER'],
  origin: 'CLIENT',
  actions: NADA,
});

export const terceiroNaBrf = membroDaEmpresa({
  id: 'u-paulo',
  membershipId: 'm-brf-paulo',
  name: 'Paulo',
  email: 'paulo@manutencao.com',
  roles: ['EXECUTOR'],
  executorType: 'THIRD_PARTY',
  origin: 'EXTERNAL',
  actions: { ...NADA, changeRoles: true, removeFromCompany: true },
});

export const EQUIPE_DA_BRF: CompanyMember[] = [carlaNaBrf, marcosNaBrf, terceiroNaBrf];

// ─────────────────────────────────────────────────────────────────────────────
// Desligamento
// ─────────────────────────────────────────────────────────────────────────────

export function prévia(over: Partial<DisableUserPreview> = {}): DisableUserPreview {
  return {
    allowed: true,
    requiresSuccessor: false,
    successorReasons: [],
    eligibleSuccessors: [],
    ...over,
  };
}
