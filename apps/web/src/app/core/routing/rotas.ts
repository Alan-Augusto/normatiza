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

import { PAGINAS_DOS_EMAILS } from '@normatiza/shared';

function empresa(companyId: string) {
  const raiz = `/app/empresas/${companyId}`;
  return {
    raiz,
    painel: `${raiz}/painel`,
    equipamentos: `${raiz}/equipamentos`,
    equipe: `${raiz}/equipe`,
    planoDeAcao: `${raiz}/plano-de-acao`,
    equipamento: (equipmentId: string) => equipamento(raiz, equipmentId),
  };
}

function equipamento(daEmpresa: string, equipmentId: string) {
  const raiz = `${daEmpresa}/equipamentos/${equipmentId}`;
  return {
    raiz,
    painel: `${raiz}/painel`,
    analise: `${raiz}/analise`,
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
  editarEmpresa: (companyId: string) => `/app/empresas/${companyId}/editar`,
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
