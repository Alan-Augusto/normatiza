import type { Role, SessionUser } from '@normatiza/shared';

/**
 * Onde cada papel cai depois do login ([03 §1](../../../../../docs/produto/03_navegacao_e_telas.md)).
 *
 * Vive separado do componente de login de propósito: a mesma decisão vale para
 * quem acabou de entrar, para quem aceitou um convite e para quem teve a sessão
 * restaurada no boot. Uma regra só, num lugar só.
 */

/**
 * Do contexto mais alto para o mais baixo. A ordem é a regra: quem acumula
 * papéis entra pela porta maior — um Engenheiro da Consultoria que também é
 * Executor tem uma carteira para administrar, e cair na fila de tarefas seria
 * entrar pela porta menor.
 */
export const CONTEXTO_1: readonly Role[] = ['LEAD_ENGINEER', 'CONSULTANT_ENGINEER', 'TECHNICIAN'];
export const CONTEXTO_2: readonly Role[] = ['MANAGER', 'CLIENT_ENGINEER', 'DIRECTOR'];

/**
 * Quem enxerga dados de empresa. O Executor fica de fora: o escopo dele são as
 * próprias tarefas, e atender uma empresa não lhe dá o painel dela.
 */
export const VÊ_A_EMPRESA: readonly Role[] = [...CONTEXTO_1, ...CONTEXTO_2];

export function rotaDeEntrada(session: SessionUser): string {
  // O Contexto 0 não é papel de vínculo: é a dimensão de plataforma, sobreposta
  // ao login normal. Quem é as duas coisas — dono da plataforma e Engenheiro
  // Responsável da própria consultoria — entra pelo backoffice e transita para
  // a consultoria pelo menu, sem trocar de login.
  if (session.isPlatformAdmin) return '/admin';

  return rotaDaConsultoria(session);
}

/**
 * A porta de entrada **do lado da aplicação**, ignorando a dimensão de
 * plataforma. É o topo do contexto de quem está dentro de `/app`.
 *
 * Existe separada porque o admin da plataforma precisa de um destino em `/app`
 * quando volta do backoffice — e `rotaDeEntrada` sempre o mandaria de volta
 * para `/admin`.
 */
export function rotaDaConsultoria(session: SessionUser): string {
  const ativos = session.memberships.filter((vínculo) => vínculo.isActive);
  const tem = (papéis: readonly Role[]) =>
    ativos.filter((vínculo) => vínculo.roles.some((papel) => papéis.includes(papel)));

  if (tem(CONTEXTO_1).length > 0) return '/app/dashboard';

  // Todo papel do lado cliente pertence a uma única empresa: não existe nada
  // acima dela para navegar, e mostrar o Contexto 1 revelaria à BRF que a
  // consultoria atende a Seara também.
  const naEmpresa = tem(CONTEXTO_2)[0];
  if (naEmpresa) return `/app/companies/${naEmpresa.companyId}/dashboard`;

  if (tem(['EXECUTOR']).length > 0) return '/app/execution';

  // Acontece com quem foi desligado de todas as empresas mas ainda tem login.
  // Precisa de uma tela que exista, não de um dashboard vazio sem explicação.
  return '/app/profile';
}
