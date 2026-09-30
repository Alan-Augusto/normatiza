/**
 * Todo endereço da aplicação, num lugar só (docs/web/arquitetura.md §3).
 *
 * A URL é a parte do sistema que o usuário lê — na barra do navegador, no link
 * que recebe por e-mail, no favorito que salva — e por isso é em português. O
 * código continua em inglês: pastas, componentes e a API.
 *
 * Nenhuma tela escreve um caminho à mão. Link, `navigate` e guarda pedem o
 * endereço aqui, e o `rotas.spec.ts` confere que cada um deles casa com uma
 * rota declarada em `app.routes.ts`: renomear vira mexer em dois arquivos, e um
 * caminho digitado errado não chega à tela.
 */

import { PAGINAS_DOS_EMAILS, equipmentCodeForUrl } from '@normatiza/shared';

/**
 * A empresa entra na URL pelo **slug**, não pelo id (docs/produto/03 §4): é a
 * parte que a pessoa lê. Quem precisa do id o obtém com `empresaDaRota()`.
 */
function empresa(slug: string) {
  const raiz = `/app/empresas/${slug}`;
  return {
    raiz,
    painel: `${raiz}/painel`,
    equipamentos: `${raiz}/equipamentos`,
    novoEquipamento: `${raiz}/equipamentos/novo`,
    setores: `${raiz}/setores`,
    equipe: `${raiz}/equipe`,
    planoDeAcao: `${raiz}/plano-de-acao`,
    equipamento: (code: string) => equipamento(raiz, code),
  };
}

/**
 * O equipamento entra na URL pelo **código**, em minúsculas (`eq-0042`) — o
 * código é imutável e único na empresa (docs/produto/03 §4.2), e a API aceita
 * qualquer caixa.
 */
function equipamento(daEmpresa: string, code: string) {
  const raiz = `${daEmpresa}/equipamentos/${equipmentCodeForUrl(code)}`;
  return {
    raiz,
    painel: `${raiz}/painel`,
    editar: `${raiz}/editar`,
    analise: `${raiz}/analise`,
    /** O assistente de uma análise, pelo número dela na máquina. */
    analiseNumero: (numero: number) => `${raiz}/analise/${numero}`,
    historico: `${raiz}/historico`,
  };
}

export const ROTAS = {
  // ÁREA PÚBLICA
  inicio: '/',
  entrar: '/entrar',
  aceitarConvite: PAGINAS_DOS_EMAILS.aceitarConvite,
  esqueciASenha: '/esqueci-a-senha',
  redefinirSenha: PAGINAS_DOS_EMAILS.redefinirSenha,
  precos: '/precos',
  apresentacao: '/apresentacao',
  apresentacaoParaImprimir: '/apresentacao/imprimir',

  // ÁREA AUTENTICADA
  app: '/app',

  // Contexto 1 — Consultoria
  painel: '/app/painel',
  empresas: '/app/empresas',
  novaEmpresa: '/app/empresas/nova',
  editarEmpresa: (slug: string) => `/app/empresas/${slug}/editar`,
  equipe: '/app/equipe',
  solucoes: '/app/catalogos/solucoes',

  // Contextos 2 e 3 — Empresa e Equipamento
  empresa,

  // Transversais
  execucao: '/app/execucao',
  perfil: '/app/perfil',
  assinatura: '/app/assinatura',

  // Contexto 0 — Admin da plataforma
  admin: {
    raiz: '/admin',
    contas: '/admin/contas',
    compras: '/admin/compras',
    administradores: '/admin/administradores',
    designSystem: '/admin/design-system',
  },
} as const;
