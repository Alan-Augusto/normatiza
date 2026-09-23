/**
 * O status de uma empresa — e por que três dos quatro não são gravados.
 *
 * Regra de negócio: docs/produto/03_navegacao_e_telas.md §3.2 e
 * 04_modelo_de_dados.md §2.
 */

import type { Role, UserStatus } from '../auth';

/**
 * Quem administra o cadastro de empresas: os dois papéis de consultoria que
 * assinam. O Técnico enxerga a carteira mas não mexe nela, e o lado cliente vê
 * a própria empresa sem editá-la (docs/produto/03 §3.2). O titular da conta
 * também cadastra, mesmo sem vínculo — isso é regra da titularidade, não do papel.
 */
export const COMPANY_ADMIN_ROLES: readonly Role[] = ['LEAD_ENGINEER', 'CONSULTANT_ENGINEER'];

export type CompanyStatus =
  /** Nenhum Gestor, nem convidado. */
  | 'IMPLANTATION'
  /** Há Gestor convidado; nenhum aceitou. */
  | 'AWAITING_MANAGER'
  /** Ao menos um Gestor aceitou o convite. */
  | 'ACTIVE'
  /** Desativada pela consultoria: modo leitura. */
  | 'INACTIVE';

export const COMPANY_STATUS_LABEL: Readonly<Record<CompanyStatus, string>> = {
  IMPLANTATION: 'Em implantação',
  AWAITING_MANAGER: 'Aguardando Gestor',
  ACTIVE: 'Ativa',
  INACTIVE: 'Inativa',
};

/** A ordem do ciclo — é a ordem do filtro, e não a alfabética. */
export const COMPANY_STATUS_ORDER: readonly CompanyStatus[] = [
  'IMPLANTATION',
  'AWAITING_MANAGER',
  'ACTIVE',
  'INACTIVE',
];

/** Um Gestor da empresa, com o que é preciso saber para decidir se ele conta. */
export interface ManagerSeat {
  userStatus: UserStatus;
  /** O convite dele, quando ainda não aceitou. */
  invitation?: { status: 'PENDING' | 'ACCEPTED' | 'REVOKED'; expiresAt: Date | string } | null;
}

/**
 * Deriva o status. Só `INACTIVE` é gravado, porque é o único que alguém decide.
 *
 * Os outros três decorrem de haver Gestor, e um deles muda **sem evento
 * nenhum**: o convite expira por tempo, e a empresa volta a *em implantação*
 * sem que ninguém aperte botão. Gravado, o status mentiria até a próxima
 * escrita.
 *
 * Convite enviado e ainda não aceito **não** torna a empresa ativa: quem não
 * entrou no sistema não aprova plano de ação nenhum.
 */
export function deriveCompanyStatus(
  company: { deactivatedAt?: Date | string | null; managers: readonly ManagerSeat[] },
  now: Date = new Date(),
): CompanyStatus {
  if (company.deactivatedAt) return 'INACTIVE';

  if (company.managers.some((m) => m.userStatus === 'ACTIVE')) return 'ACTIVE';

  const aguardando = company.managers.some(
    (m) =>
      m.userStatus === 'INVITED' &&
      m.invitation?.status === 'PENDING' &&
      new Date(m.invitation.expiresAt) > now,
  );

  return aguardando ? 'AWAITING_MANAGER' : 'IMPLANTATION';
}

/**
 * Empresa inativa é **modo leitura**: nada muda dentro dela. Uma pergunta só,
 * para que toda mutação a faça do mesmo jeito.
 */
export function isCompanyReadOnly(status: CompanyStatus): boolean {
  return status === 'INACTIVE';
}
