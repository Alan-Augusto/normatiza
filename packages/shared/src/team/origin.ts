/**
 * De onde a pessoa vem, na visão de **uma empresa**.
 *
 * É a coluna "Origem" da Equipe da Empresa ([03 §4.5](../../../../docs/produto/03_navegacao_e_telas.md)):
 * o Marcos precisa distinguir quem é da consultoria que o atende, quem é
 * funcionário dele e quem é terceiro contratado — três relações contratuais
 * diferentes, com expectativas diferentes sobre quem manda em quem.
 *
 * Derivada, nunca persistida — mesmo princípio de `ROLE_SIDE`. Vive aqui, e não
 * na tela, porque quem calcula é o servidor: painel web e app de campo recebem
 * o valor pronto e apenas o exibem.
 */

import { ROLE_SIDE, type ExecutorType, type Role } from '../auth';

export type MemberOrigin = 'CONSULTANCY' | 'CLIENT' | 'EXTERNAL';

export const MEMBER_ORIGIN_LABEL: Readonly<Record<MemberOrigin, string>> = {
  CONSULTANCY: 'Consultoria',
  CLIENT: 'Cliente',
  EXTERNAL: 'Terceiro',
};

/**
 * `EXTERNAL` é decidido pelo contrato, não pelo papel: `ROLE_SIDE` classifica
 * `EXECUTOR` como `CLIENT` justamente porque interno × terceiro é informação de
 * `Membership.executorType`. Por isso o tipo é consultado primeiro.
 *
 * Tendo papel de consultoria, a pessoa é da consultoria — ainda que também
 * carregue algum papel do lado cliente no mesmo vínculo. A pergunta da coluna é
 * "de onde ela vem", e vir da consultoria é o fato mais forte dos dois.
 */
export function memberOrigin(
  roles: readonly Role[],
  executorType?: ExecutorType,
): MemberOrigin {
  if (executorType === 'THIRD_PARTY') return 'EXTERNAL';
  if (roles.some((papel) => ROLE_SIDE[papel] === 'CONSULTANCY')) return 'CONSULTANCY';
  return 'CLIENT';
}
