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

/**
 * Conceder acesso ao Contexto 0, **por e-mail exato**.
 *
 * Não há busca por trecho de nome ou de e-mail de propósito. Não é sigilo — um
 * admin de plataforma já enxerga as contas por definição —, é que uma busca
 * parcial seria uma ferramenta de varredura do cadastro inteiro, e para
 * promover alguém você já sabe o endereço exato dessa pessoa.
 */
export interface GrantPlatformAdminRequest {
  email: string;
  /**
   * O desempate. `User.email` é único **por conta**, não globalmente — o mesmo
   * endereço pode ser duas pessoas em duas consultorias (é a mesma razão de o
   * login ter a escolha de conta, D16). Vem preenchido só na segunda tentativa,
   * depois de o servidor ter devolvido os candidatos.
   */
  userId?: string;
}

/** Uma das pessoas que o e-mail informado alcança. */
export interface PlatformAdminCandidate {
  userId: string;
  name: string;
  /** Só o Contexto 0 recebe nome de conta — é a única camada que enxerga todas. */
  accountName: string;
}

export interface AmbiguousGrantResponse {
  reason: 'USER_SELECTION_REQUIRED';
  candidates: PlatformAdminCandidate[];
}
