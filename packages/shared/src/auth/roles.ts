/**
 * Papéis e escopo.
 * Regra de negócio: docs/produto/01_papeis_e_permissoes.md
 */

/**
 * Papel **no vínculo** — sempre "…nesta empresa, desta conta".
 *
 * O Admin do Sistema **não** está aqui de propósito: ele é a plataforma, não
 * uma pessoa dentro da operação de um cliente ([01](../../../../docs/produto/01_papeis_e_permissoes.md)),
 * e o escopo dele é global. Espremê-lo num `Membership` obrigaria a pendurá-lo
 * numa empresa de uma consultoria cliente — o documento diria "global" e o banco
 * diria "uma empresa de uma conta". Ele vive em `PlatformAdmin`.
 */
export type Role =
  | 'LEAD_ENGINEER' // Engenheiro Responsável — consultoria
  | 'CONSULTANT_ENGINEER' // Engenheiro da Consultoria
  | 'TECHNICIAN' // Técnico
  | 'MANAGER' // Gestor — cliente
  | 'CLIENT_ENGINEER' // Engenheiro do Cliente
  | 'DIRECTOR' // Diretor — leitura
  | 'EXECUTOR'; // Executor

export type RoleSide = 'CONSULTANCY' | 'CLIENT' | 'EXTERNAL';

/**
 * Como cada papel se chama para quem usa o sistema — os mesmos nomes de
 * docs/produto/01_papeis_e_permissoes.md.
 *
 * Fica aqui, e não em cada tela, porque painel web e app de campo precisam
 * chamar a mesma coisa pelo mesmo nome: um "Engenheiro do Cliente" que virasse
 * "Eng. Cliente" no celular já seriam dois vocabulários para o mesmo papel.
 */
export const ROLE_LABEL: Readonly<Record<Role, string>> = {
  LEAD_ENGINEER: 'Engenheiro Responsável',
  CONSULTANT_ENGINEER: 'Engenheiro da Consultoria',
  TECHNICIAN: 'Técnico',
  MANAGER: 'Gestor',
  CLIENT_ENGINEER: 'Engenheiro do Cliente',
  DIRECTOR: 'Diretor',
  EXECUTOR: 'Executor',
};

/**
 * O que a pessoa **faz** com aquele papel, numa linha, na voz de quem opera.
 *
 * Mora aqui, e não na tela, pela mesma razão de `ROLE_LABEL`: é lido em três
 * lugares — no convite (para decidir), em Meu Perfil (para a pessoa entender o
 * que ela é) e no guia de papéis — e três cópias divergiriam na primeira
 * correção de texto.
 *
 * O texto é o resumo do §4 de docs/produto/01_papeis_e_permissoes.md. Mudou
 * lá, muda aqui.
 */
export const ROLE_SUMMARY: Readonly<Record<Role, string>> = {
  LEAD_ENGINEER:
    'Dono da conta. Cadastra empresas, faz e conclui análises, valida evidências e assina o laudo.',
  CONSULTANT_ENGINEER:
    'Faz e conclui análises, valida evidências e emite laudo — nas empresas que receber no escopo.',
  TECHNICIAN:
    'Vai a campo: mede a máquina, preenche a ficha técnica, fotografa e levanta os pontos de risco.',
  MANAGER:
    'Responde pela empresa. Aprova orçamento e prazo, e administra quem tem acesso do lado do cliente.',
  CLIENT_ENGINEER:
    'Transforma a análise em obra: define responsável, prazo e orçamento de cada ponto, e entrega a evidência.',
  DIRECTOR: 'Acompanha painéis, grau de adequação, investimento e baixa os laudos prontos.',
  EXECUTOR: 'Recebe as tarefas designadas a ela, executa e sobe a foto do que fez.',
};

/**
 * O que aquele papel **não** faz — e é metade das regras deste sistema.
 *
 * Existe separado do resumo de propósito. "O Engenheiro do Cliente nunca toca
 * na análise" é exatamente a dúvida de quem está escolhendo um papel, e é a
 * frase que a interface calava: um nome de cargo sozinho não diz o que ele
 * **não** alcança, e é aí que a escolha erra.
 */
export const ROLE_LIMIT: Readonly<Record<Role, string>> = {
  LEAD_ENGINEER: 'Não aprova orçamento de cliente — quem decide gastar é a empresa.',
  CONSULTANT_ENGINEER: 'Não enxerga empresas fora do escopo que recebeu.',
  TECHNICIAN: 'Não conclui análise nem emite laudo — entrega o levantamento para o engenheiro.',
  MANAGER: 'Não cria nem edita análise: a apreciação de riscos é da consultoria.',
  CLIENT_ENGINEER: 'Não toca na análise e não aprova o próprio orçamento — quem aprova é o Gestor.',
  DIRECTOR: 'Leitura pura: não move, não aprova e não cadastra nada.',
  EXECUTOR: 'Não vê a análise, o HRN, os outros pontos da máquina nem as outras máquinas.',
};

/**
 * A ordem em que os papéis se apresentam a quem escolhe: por **alçada**, dentro
 * de cada lado — a mesma da tabela do §4 de
 * docs/produto/01_papeis_e_permissoes.md.
 *
 * Nunca alfabética. Em ordem alfabética "Diretor" — leitura pura — vem antes de
 * "Gestor", e uma lista sugere hierarquia mesmo quando não promete nenhuma.
 */
export const ROLE_ORDER: readonly Role[] = [
  'LEAD_ENGINEER',
  'CONSULTANT_ENGINEER',
  'TECHNICIAN',
  'MANAGER',
  'CLIENT_ENGINEER',
  'DIRECTOR',
  'EXECUTOR',
];

/**
 * O lado é atributo do papel, não do usuário — e é o que separa quem produz a
 * análise de quem a executa. Derivado, nunca persistido: coluna e mapa poderiam
 * divergir, e aqui não há duas verdades possíveis.
 *
 * `EXECUTOR` aparece como `CLIENT` porque o tipo (interno × terceiro) é
 * contratual, não de sistema — vive em `Membership.executorType`.
 */
export const ROLE_SIDE: Readonly<Record<Role, RoleSide>> = {
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

/**
 * Quem assume **responsabilidade técnica** perante o cliente: emite e assina o
 * laudo, com o próprio registro profissional.
 *
 * É por isso que só estes dois aparecem ao cliente como responsáveis pela
 * empresa dele. O Técnico é da consultoria e trabalha naquela planta, mas não
 * assina nada — nomeá-lo ao cliente seria expor a equipe da consultoria sem que
 * exista relação de responsabilidade que o justifique
 * (docs/produto/01_papeis_e_permissoes.md §4).
 */
export const SIGNING_ROLES: readonly Role[] = ['LEAD_ENGINEER', 'CONSULTANT_ENGINEER'];

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

/**
 * Os papéis que quem tem `inviterRoles` pode conceder, **em ordem de alçada**.
 *
 * A ordenação não é cosmética: sem ela, a lista sai na ordem em que os vínculos
 * de quem convida vieram do banco — quem tem dois papéis veria uma ordem, quem
 * tem um veria outra, e a mesma tela mudaria de forma sem nenhuma razão visível
 * para quem olha.
 */
export function invitableRoles(inviterRoles: readonly Role[]): Role[] {
  const união = new Set<Role>();
  for (const role of inviterRoles) {
    for (const alvo of CAN_INVITE[role]) união.add(alvo);
  }
  return ROLE_ORDER.filter((papel) => união.has(papel));
}

/** O rótulo do lado, como cabeçalho de grupo na escolha do papel. */
export const ROLE_SIDE_LABEL: Readonly<Record<RoleSide, string>> = {
  CONSULTANCY: 'Na consultoria — quem produz a análise',
  CLIENT: 'Na empresa cliente — quem executa a adequação',
  EXTERNAL: 'Externo',
};

/**
 * Agrupa **os papéis dados** por lado, cada grupo em ordem de alçada.
 *
 * Recebe a lista a exibir, e não a de quem convida: quem já aplicou
 * `CAN_INVITE` foi `invitableRoles`, e aplicá-lo de novo aqui perguntaria
 * "quem esses papéis convidariam?" — outra pergunta, com resposta plausível o
 * bastante para passar despercebida. Ao Gestor, que concede três papéis,
 * sobraria **um**.
 *
 * Um grupo só significa que **não há título de grupo a mostrar**: quem decide
 * isso é quem renderiza, olhando o tamanho da lista. Só o Engenheiro
 * Responsável alcança os dois lados.
 */
export function rolesBySide(roles: readonly Role[]): { side: RoleSide; roles: Role[] }[] {
  const grupos = new Map<RoleSide, Role[]>();

  for (const papel of ROLE_ORDER.filter((papel) => roles.includes(papel))) {
    const lado = ROLE_SIDE[papel];
    const atual = grupos.get(lado);
    if (atual) atual.push(papel);
    else grupos.set(lado, [papel]);
  }

  return [...grupos].map(([side, roles]) => ({ side, roles }));
}

/**
 * Papéis que assinam responsabilidade técnica, e por isso têm registro
 * profissional — CREA para engenheiro, CFT para técnico.
 *
 * É a regra do "quando Engenheiro/Técnico" de
 * [03 §3.3](../../../../docs/produto/03_navegacao_e_telas.md), escrita uma vez:
 * o formulário de convite e a tela de perfil precisam concordar sobre a quem
 * perguntar isso. Gestor, Diretor e Executor ficam de fora porque não emitem
 * laudo — pedir-lhes um número de conselho é pedir documento que não existe.
 */
export const REGISTRY_ROLES: readonly Role[] = [
  'LEAD_ENGINEER',
  'CONSULTANT_ENGINEER',
  'TECHNICIAN',
  'CLIENT_ENGINEER',
];

export function hasProfessionalRegistry(roles: readonly Role[]): boolean {
  return roles.some((papel) => REGISTRY_ROLES.includes(papel));
}
