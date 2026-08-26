/**
 * Papéis e escopo.
 * Regra de negócio: docs/produto/01_papeis_e_permissoes.md
 */

export type Role =
  | 'SYSTEM_ADMIN'
  | 'LEAD_ENGINEER' // Engenheiro Responsável — consultoria
  | 'CONSULTANT_ENGINEER' // Engenheiro da Consultoria
  | 'TECHNICIAN' // Técnico
  | 'MANAGER' // Gestor — cliente
  | 'CLIENT_ENGINEER' // Engenheiro do Cliente
  | 'DIRECTOR' // Diretor — leitura
  | 'EXECUTOR'; // Executor

export type RoleSide = 'PLATFORM' | 'CONSULTANCY' | 'CLIENT' | 'EXTERNAL';

/**
 * Como cada papel se chama para quem usa o sistema — os mesmos nomes de
 * docs/produto/01_papeis_e_permissoes.md.
 *
 * Fica aqui, e não em cada tela, porque painel web e app de campo precisam
 * chamar a mesma coisa pelo mesmo nome: um "Engenheiro do Cliente" que virasse
 * "Eng. Cliente" no celular já seriam dois vocabulários para o mesmo papel.
 */
export const ROLE_LABEL: Readonly<Record<Role, string>> = {
  SYSTEM_ADMIN: 'Admin do Sistema',
  LEAD_ENGINEER: 'Engenheiro Responsável',
  CONSULTANT_ENGINEER: 'Engenheiro da Consultoria',
  TECHNICIAN: 'Técnico',
  MANAGER: 'Gestor',
  CLIENT_ENGINEER: 'Engenheiro do Cliente',
  DIRECTOR: 'Diretor',
  EXECUTOR: 'Executor',
};

/**
 * O lado é atributo do papel, não do usuário — e é o que separa quem produz a
 * análise de quem a executa. Derivado, nunca persistido: coluna e mapa poderiam
 * divergir, e aqui não há duas verdades possíveis.
 *
 * `EXECUTOR` aparece como `CLIENT` porque o tipo (interno × terceiro) é
 * contratual, não de sistema — vive em `Membership.executorType`.
 */
export const ROLE_SIDE: Readonly<Record<Role, RoleSide>> = {
  SYSTEM_ADMIN: 'PLATFORM',
  LEAD_ENGINEER: 'CONSULTANCY',
  CONSULTANT_ENGINEER: 'CONSULTANCY',
  TECHNICIAN: 'CONSULTANCY',
  MANAGER: 'CLIENT',
  CLIENT_ENGINEER: 'CLIENT',
  DIRECTOR: 'CLIENT',
  EXECUTOR: 'CLIENT',
};

/**
 * Papéis cujo escopo **é a empresa**. Um usuário só pode tê-los em um vínculo
 * ativo — é o que garante que a BRF nunca enxergue a Seara.
 *
 * `EXECUTOR` não está aqui de propósito: seu escopo são as próprias tarefas, e
 * atender várias empresas não lhe dá acesso a nada em nível de empresa.
 */
export const COMPANY_SCOPED_ROLES: readonly Role[] = [
  'MANAGER',
  'CLIENT_ENGINEER',
  'DIRECTOR',
];

/** Papéis com carteira: vários vínculos ativos, um por empresa atendida. */
export const PORTFOLIO_ROLES: readonly Role[] = [
  'LEAD_ENGINEER',
  'CONSULTANT_ENGINEER',
  'TECHNICIAN',
];

/**
 * Quem convida quem. O convite é a única porta de entrada do sistema, e este
 * mapa é o teto de **papel**; o teto de **escopo** é o escopo de quem convida.
 * Ambos validados no servidor — a interface não é a defesa.
 */
export const CAN_INVITE: Readonly<Record<Role, readonly Role[]>> = {
  SYSTEM_ADMIN: [],
  LEAD_ENGINEER: [
    'CONSULTANT_ENGINEER',
    'TECHNICIAN',
    'MANAGER',
    'CLIENT_ENGINEER',
    'DIRECTOR',
    'EXECUTOR',
  ],
  CONSULTANT_ENGINEER: ['TECHNICIAN'],
  TECHNICIAN: [],
  MANAGER: ['CLIENT_ENGINEER', 'DIRECTOR', 'EXECUTOR'],
  CLIENT_ENGINEER: ['EXECUTOR'],
  DIRECTOR: [],
  EXECUTOR: [],
};

export function isCompanyScopedRole(role: Role): boolean {
  return COMPANY_SCOPED_ROLES.includes(role);
}

/** A permissão efetiva de um vínculo é a união dos seus papéis. */
export function canInvite(inviterRoles: readonly Role[], target: Role): boolean {
  return inviterRoles.some((role) => CAN_INVITE[role].includes(target));
}

export function invitableRoles(inviterRoles: readonly Role[]): Role[] {
  const união = new Set<Role>();
  for (const role of inviterRoles) {
    for (const alvo of CAN_INVITE[role]) união.add(alvo);
  }
  return [...união];
}
