/**
 * Contratos de rede da gestão de equipe — convidar, ver, mudar de papel e
 * desligar.
 *
 * Duas projeções, não uma, e é de propósito: `TeamMember` é a visão **da conta**
 * e `CompanyMember` é a visão **de uma empresa**. A segunda não é a primeira
 * filtrada — ela omite o escopo inteiro da pessoa, porque o lado cliente não
 * pode descobrir que existe uma camada acima da empresa dele
 * ([03 §1](../../../../docs/produto/03_navegacao_e_telas.md)). Um `companyIds`
 * a mais nessa projeção conta ao Marcos que a Normatiza também atende a Seara.
 *
 * Regra de negócio: docs/produto/01_papeis_e_permissoes.md §5
 */

import type {
  CompanySummary,
  ExecutorType,
  RegistryType,
  Role,
  UserStatus,
} from '../auth';
import type { MemberOrigin } from './origin';

/** Uma pessoa referida por outra linha — quem convidou, quem sucedeu. */
export interface PersonRef {
  id: string;
  name: string;
}

// ─────────────────────────────────────────────────────────────────────────────
// O que a tela pode oferecer
// ─────────────────────────────────────────────────────────────────────────────

/**
 * O que **quem está olhando** pode fazer com **esta linha**.
 *
 * Vem do servidor em vez de ser recalculado na tela porque a alçada depende de
 * coisas que o front não tem: a árvore de convites (D5 — desliga-se quem não se
 * convidou) e a titularidade da conta (D12). Reimplementar isso no Angular
 * criaria uma segunda cópia de uma regra de autorização, que é exatamente o que
 * o fechamento desta feature manda não existir.
 *
 * Continua sendo decisão de **interface**: o servidor revalida tudo na mutação.
 * O que estes booleanos evitam é oferecer um botão que será recusado.
 */
export interface MemberActions {
  changeRoles: boolean;
  /** Desativar o vínculo com **esta** empresa (D8). */
  removeFromCompany: boolean;
  /** Desligar da conta inteira (D8). Sempre `false` para o titular (D12). */
  disableFromAccount: boolean;
  resendInvitation: boolean;
  revokeInvitation: boolean;
}

// ─────────────────────────────────────────────────────────────────────────────
// Contexto 1 — Equipe da conta
// ─────────────────────────────────────────────────────────────────────────────

/** Um vínculo, como a Equipe da conta o exibe: a empresa e o que a pessoa é lá. */
export interface TeamMembership {
  id: string;
  companyId: string;
  company: CompanySummary;
  roles: Role[];
  executorType?: ExecutorType;
  isActive: boolean;
}

/**
 * O convite ainda aberto.
 *
 * "Expirado" **não** é um status: é `expiresAt` no passado. Guardar os dois
 * criaria duas verdades sobre o mesmo fato, e elas divergiriam no minuto em que
 * um job de expiração falhasse. A tela compara com o relógio.
 */
export interface PendingInvitation {
  id: string;
  expiresAt: string;
}

export interface TeamMember {
  id: string;
  name: string;
  email: string;
  phone?: string;
  jobTitle?: string;
  status: UserStatus;

  /** Só os ativos. A união dos papéis é derivada daqui pela tela. */
  memberships: TeamMembership[];

  invitedBy?: PersonRef;
  lastAccessAt?: string;
  disabledAt?: string;
  succeededBy?: PersonRef;

  invitation?: PendingInvitation;
  /** Verdadeiro para quem responde pela conta — não é desligável (D12). */
  isAccountOwner: boolean;
  actions: MemberActions;
}

export interface TeamListQuery {
  role?: Role;
  companyId?: string;
  status?: UserStatus;
}

// ─────────────────────────────────────────────────────────────────────────────
// Contexto 2 — Equipe da empresa
// ─────────────────────────────────────────────────────────────────────────────

/**
 * A mesma pessoa, vista de dentro de **uma** empresa.
 *
 * Note o que não está aqui: `memberships`, `companyIds`, `isAccountOwner`. Nada
 * nesta projeção revela a existência de outra empresa, nem da conta como
 * entidade. `membershipId` é o vínculo **desta** empresa — é ele que as ações
 * desta tela mutam.
 */
export interface CompanyMember {
  id: string;
  membershipId: string;
  name: string;
  email: string;
  jobTitle?: string;
  roles: Role[];
  executorType?: ExecutorType;
  origin: MemberOrigin;
  status: UserStatus;
  lastAccessAt?: string;
  invitation?: PendingInvitation;
  /** Sem `disableFromAccount` verdadeiro nesta tela: ela não tem essa alçada. */
  actions: MemberActions;
}

// ─────────────────────────────────────────────────────────────────────────────
// Mutações do vínculo
// ─────────────────────────────────────────────────────────────────────────────

/**
 * `roles` chega **inteiro**, não como um delta. Trocar de papel é declarar o
 * conjunto final: um "adicione DIRECTOR" concorrente com um "remova MANAGER"
 * deixaria o resultado dependendo da ordem de chegada.
 */
export interface UpdateMembershipRequest {
  roles: Role[];
  executorType?: ExecutorType;
}

/**
 * O que a tela precisa saber **antes** de oferecer o desligamento (D4).
 *
 * Sem esta consulta, a alternativa seria a tela adivinhar quando a saída quebra
 * uma invariante — e errar para o lado de pedir sucessor sempre (burocracia em
 * 90% dos casos) ou de não pedir nunca (erro do servidor na cara do usuário).
 */
export interface DisableUserPreview {
  allowed: boolean;
  /** Por que não, quando `allowed` é falso — o titular da conta cai aqui (D12). */
  blockedReason?: string;
  requiresSuccessor: boolean;
  /** O que exige sucessão, em linguagem de negócio, para a tela repetir. */
  successorReasons: string[];
  /** Quem pode herdar: mesma alçada, dentro do mesmo escopo. */
  eligibleSuccessors: PersonRef[];
}

export interface DisableUserRequest {
  /** Obrigatório apenas quando o *preview* disse que é (D4). */
  successorUserId?: string;
  reason?: string;
}

// ─────────────────────────────────────────────────────────────────────────────
// Perfil próprio
// ─────────────────────────────────────────────────────────────────────────────

/**
 * O que o dono do cadastro edita em si mesmo.
 *
 * **`email` não está aqui, e não deve entrar** (D7): mudar o e-mail de um login
 * é passar a receber os links de redefinição dele. Se um dia existir troca de
 * e-mail, é fluxo próprio, com confirmação nos dois endereços — não um campo
 * neste PATCH.
 */
export interface UpdateProfileRequest {
  name?: string;
  phone?: string;
  jobTitle?: string;
  registryType?: RegistryType;
  registryNumber?: string;
}

/**
 * Trocar a própria senha.
 *
 * `currentPassword` é exigido mesmo havendo sessão válida: uma aba esquecida
 * aberta não pode bastar para trocar a credencial permanente.
 */
export interface ChangePasswordRequest {
  currentPassword: string;
  newPassword: string;
}
