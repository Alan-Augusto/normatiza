/**
 * Conta, identidade e vínculo — as formas que **trafegam** entre API, painel web
 * e app de campo.
 *
 * Estas interfaces são o contrato de rede, não o espelho do banco: nenhum campo
 * de credencial (`passwordHash`, `passwordAlgo`, `legacyPasswordSalt`) aparece
 * aqui, e não deve aparecer nunca — o que não existe no contrato não vaza por
 * descuido de serialização.
 *
 * Regra de negócio: docs/produto/04_modelo_de_dados.md §1
 */

import type { Role } from './roles';

export type AccountStatus = 'ACTIVE' | 'SUSPENDED';
export type UserStatus = 'INVITED' | 'ACTIVE' | 'DISABLED';
export type RegistryType = 'CREA' | 'CFT';
export type ExecutorType = 'INTERNAL' | 'THIRD_PARTY';

/** A consultoria assinante. Unidade de faturamento e de isolamento. */
export interface Account {
  id: string;
  name: string;
  document: string;
  ownerUserId?: string;
  status: AccountStatus;
}

/** A pessoa. Um login, independente de quantos papéis tenha. */
export interface User {
  id: string;
  accountId: string;
  name: string;
  email: string;
  phone?: string;

  registryType?: RegistryType;
  registryNumber?: string;
  jobTitle?: string;

  invitedByUserId?: string;
  status: UserStatus;
  disabledAt?: string;
  succeededByUserId?: string;
  lastAccessAt?: string;
}

/** Um usuário × uma empresa × um ou mais papéis. */
export interface Membership {
  id: string;
  accountId: string;
  userId: string;
  companyId: string;
  /** A permissão efetiva é a união destes papéis. */
  roles: Role[];
  executorType?: ExecutorType;
  supplierId?: string;
  isActive: boolean;
}

/** Projeção mínima de empresa — o suficiente para exibir um vínculo. */
export interface CompanySummary {
  id: string;
  tradeName: string;
  corporateName: string;
  isActive: boolean;
}

/** Vínculo já resolvido com a empresa, como o front consome. */
export interface MembershipWithCompany extends Membership {
  company: CompanySummary;
}
