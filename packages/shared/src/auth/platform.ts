/**
 * Admin da Plataforma — o Contexto 0.
 *
 * Não é um papel de vínculo ([roles.ts](./roles.ts) explica por quê): é uma
 * dimensão própria da pessoa, sobreposta ao login que ela já tem. O Josué é
 * Engenheiro Responsável da consultoria dele **e** admin da plataforma com o
 * mesmo e-mail, a mesma senha e um login só.
 *
 * Regra de negócio: docs/produto/01_papeis_e_permissoes.md
 */

/**
 * Uma concessão de acesso ao Contexto 0.
 *
 * `grantedByUserId` é o que torna a concessão auditável: um booleano responde
 * "é admin?", isto responde "quem o tornou admin, e quando" — que é a pergunta
 * que aparece numa auditoria de verdade e que ninguém reconstrói depois.
 */
export interface PlatformAdmin {
  id: string;
  userId: string;
  name: string;
  email: string;
  /** Nulo apenas no primeiro admin, criado por linha de comando. */
  grantedByUserId?: string;
  grantedAt: string;
  revokedAt?: string;
}

export interface GrantPlatformAdminRequest {
  userId: string;
}
