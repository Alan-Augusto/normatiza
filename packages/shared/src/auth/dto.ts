/**
 * Contratos de rede da autenticação.
 * Nenhuma interface de API pode ser declarada localmente no front ou no app —
 * o que trafega entre os três é declarado aqui.
 */

import type { Account, ExecutorType, MembershipWithCompany, User } from './identity';
import type { Role } from './roles';

// ─────────────────────────────────────────────────────────────────────────────
// Sessão
// ─────────────────────────────────────────────────────────────────────────────

/**
 * O conteúdo do access token.
 *
 * `accountId` viaja **explícito** e não é inferido do usuário: se um dia a
 * identidade precisar atravessar contas, a autenticação não é reescrita.
 *
 * Papéis **não** entram no token de propósito. Eles vivem no vínculo, mudam sem
 * aviso e valem por empresa — um token de 15 minutos carregando permissão seria
 * permissão desatualizada por até 15 minutos. A autorização é resolvida no
 * servidor a cada requisição.
 */
export interface AccessTokenClaims {
  /** `User.id` */
  sub: string;
  accountId: string;
  iat: number;
  exp: number;
}

export interface LoginRequest {
  email: string;
  password: string;
  /**
   * Só é enviado na **segunda** tentativa, depois de a API ter respondido `409`
   * com as consultorias candidatas. No caso normal — que é praticamente todos —
   * não existe.
   *
   * Não é credencial nem é confiado: a senha viaja junto e é verificada contra
   * o usuário daquela conta. `accountId` arbitrário apenas falha a autenticação.
   */
  accountId?: string;
}

/** Uma das consultorias em que o e-mail e a senha informados são válidos. */
export interface AccountChoice {
  id: string;
  name: string;
}

/**
 * Corpo do `409` quando o mesmo e-mail e senha valem em mais de uma conta —
 * possível porque `User.email` é único por conta, não globalmente ([04 §1](../produto/04_modelo_de_dados.md)).
 *
 * A lista só é devolvida **após a senha ser verificada e bater**. Devolvê-la
 * antes transformaria o login num oráculo: bastaria digitar um e-mail para
 * descobrir de quais consultorias aquela pessoa é cliente.
 */
export interface AmbiguousLoginResponse {
  reason: 'ACCOUNT_SELECTION_REQUIRED';
  accounts: AccountChoice[];
}

/**
 * O refresh token **não** aparece aqui: no web ele viaja em cookie `httpOnly`,
 * fora do alcance do JavaScript. O app de campo, que não usa cookie, recebe-o
 * no cabeçalho `X-Refresh-Token`.
 */
export interface LoginResponse {
  accessToken: string;
  /** Segundos até o access token expirar — o front agenda o refresh silencioso. */
  expiresIn: number;
  session: SessionUser;
}

export type RefreshResponse = LoginResponse;

/** O que `GET /auth/me` devolve: quem é, de que conta, e com que vínculos. */
export interface SessionUser {
  user: User;
  account: Account;
  memberships: MembershipWithCompany[];
  /**
   * Acesso ao Contexto 0, sobreposto ao login normal — não é um papel de
   * vínculo ([platform.ts](./platform.ts)). É o que faz o menu mostrar
   * "Admin da Plataforma" a quem tem, e só a quem tem.
   *
   * Como todo o resto, decide **navegação**: o servidor revalida a cada
   * requisição do Contexto 0.
   */
  isPlatformAdmin: boolean;
}

// ─────────────────────────────────────────────────────────────────────────────
// Convite — a única porta de entrada
// ─────────────────────────────────────────────────────────────────────────────

export interface CreateInvitationRequest {
  name: string;
  email: string;
  roles: Role[];
  /**
   * Empresas oferecidas. Subconjunto do escopo de quem convida, validado no
   * servidor. Para papéis cujo escopo é a empresa, exatamente uma.
   */
  companyIds: string[];
  executorType?: ExecutorType;
  jobTitle?: string;
  phone?: string;
}

export interface InvitationSummary {
  id: string;
  userId: string;
  name: string;
  email: string;
  roles: Role[];
  companyIds: string[];
  status: 'PENDING' | 'ACCEPTED' | 'REVOKED';
  expiresAt: string;
  invitedByUserId: string;
  createdAt: string;
}

/** O convidado nunca preenche cadastro: ele só define a senha. */
export interface AcceptInvitationRequest {
  token: string;
  password: string;
}

// ─────────────────────────────────────────────────────────────────────────────
// Recuperação de senha
// ─────────────────────────────────────────────────────────────────────────────

export interface ForgotPasswordRequest {
  email: string;
}

export interface ResetPasswordRequest {
  token: string;
  password: string;
}

/**
 * Resposta deliberadamente idêntica para e-mail existente e inexistente: dizer
 * "não encontrei esse e-mail" é confirmar quem é cliente de quem.
 */
export interface ForgotPasswordResponse {
  message: string;
}
