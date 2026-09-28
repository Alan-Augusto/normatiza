/**
 * Quem mexe no inventário da planta (docs/produto/03 §4.2 e 01 §7).
 */

import type { Role } from '../auth';

/**
 * Cadastram e editam equipamentos e setores, na empresa do vínculo: a
 * consultoria que levanta a planta e o lado cliente que a opera.
 */
export const EQUIPMENT_EDITOR_ROLES: readonly Role[] = [
  'LEAD_ENGINEER',
  'CONSULTANT_ENGINEER',
  'TECHNICIAN',
  'MANAGER',
  'CLIENT_ENGINEER',
];

/** Veem o inventário. O Executor não: o escopo dele são as próprias tarefas. */
export const EQUIPMENT_READER_ROLES: readonly Role[] = [...EQUIPMENT_EDITOR_ROLES, 'DIRECTOR'];

/**
 * Criam tipo de máquina novo no catálogo. O catálogo é da consultoria, e o que
 * um cliente digitasse apareceria para todos os outros clientes dela.
 */
export const MACHINE_TYPE_CREATOR_ROLES: readonly Role[] = [
  'LEAD_ENGINEER',
  'CONSULTANT_ENGINEER',
  'TECHNICIAN',
];

/** Os papéis de quem pergunta, numa empresa, dão direito a editar o inventário dela? */
export function canEditInventory(rolesInCompany: readonly Role[], companyInactive: boolean): boolean {
  return !companyInactive && rolesInCompany.some((papel) => EQUIPMENT_EDITOR_ROLES.includes(papel));
}
