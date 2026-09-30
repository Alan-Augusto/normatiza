import { type Route, type Routes } from '@angular/router';
import { describe, expect, it } from 'vitest';
import { routes } from '../../app.routes';
import { SLUGS_RESERVADOS_DE_EMPRESA } from '@normatiza/shared';

import { ROTAS } from './rotas';

/**
 * Casa um endereço com a configuração do roteador, do jeito que ele casa:
 * segmento a segmento, `:param` aceitando qualquer valor, rota de caminho vazio
 * atravessada. Só conta como encontrada uma rota que **abre uma tela** — um
 * redirecionamento no meio do caminho não é destino.
 */
function abreUmaTela(url: string, config: Routes = routes): boolean {
  const segmentos = url.split('?')[0].split('/').filter(Boolean);
  return casa(segmentos, config);
}

function casa(segmentos: string[], config: Routes): boolean {
  return config.some((rota) => {
    if (rota.path === '**' || rota.redirectTo !== undefined) return false;
    const partes = (rota.path ?? '').split('/').filter(Boolean);
    if (partes.length > segmentos.length) return false;
    const bate = partes.every((parte, i) => parte.startsWith(':') || parte === segmentos[i]);
    if (!bate) return false;

    const resto = segmentos.slice(partes.length);
    if (resto.length === 0 && abreTela(rota)) return true;
    return rota.children ? casa(resto, rota.children) : false;
  });
}

function abreTela(rota: Route): boolean {
  if (!rota.component && !rota.loadComponent) return false;
  if (!rota.children) return true;

  // Um layout só é destino pelo filho vazio: `/app` é o painel, por redirecionamento.
  const vazio = rota.children.find((filho) => filho.path === '');
  if (!vazio) return false;
  if (typeof vazio.redirectTo === 'string') return casa([vazio.redirectTo], rota.children);
  return !vazio.redirectTo && abreTela(vazio);
}

/** Todas as strings de ROTAS, com os construtores chamados com ids de exemplo. */
function todosOsEndereços(): string[] {
  const empresa = ROTAS.empresa('emp-1');
  const equipamento = empresa.equipamento('EQ-0001');
  const { empresa: _e, editarEmpresa: _ed, admin, ...fixos } = ROTAS;
  return [
    ...Object.values(fixos),
    ROTAS.editarEmpresa('emp-1'),
    empresa.painel,
    empresa.equipamentos,
    empresa.novoEquipamento,
    empresa.setores,
    empresa.equipe,
    empresa.planoDeAcao,
    equipamento.painel,
    equipamento.editar,
    equipamento.analise,
    equipamento.analiseNumero(1),
    equipamento.historico,
    ...Object.values(admin),
  ];
}

describe('ROTAS', () => {
  it('deve apontar cada endereço para uma tela que existe', () => {
    const quebrados = todosOsEndereços().filter((url) => !abreUmaTela(url));
    expect(quebrados).toEqual([]);
  });

  it('deve ter as URLs em português', () => {
    expect(ROTAS.empresa('brf').equipamento('EQ-0042').analise).toBe(
      '/app/empresas/brf/equipamentos/eq-0042/analise',
    );
    expect(ROTAS.editarEmpresa('emp-1')).toBe('/app/empresas/emp-1/editar');
  });

  it('deve reservar toda tela declarada ao lado das empresas, para nenhuma empresa ganhar o mesmo slug', () => {
    // Uma empresa chamada "Nova" com slug `nova` nunca abriria: a URL dela é
    // o formulário de cadastro.
    const app = routes.find((r) => r.path === 'app')!.children!;
    const telasAoLado = app
      .map((r) => r.path ?? '')
      .filter((path) => path.startsWith('empresas/'))
      .map((path) => path.split('/')[1])
      .filter((segmento) => !segmento.startsWith(':'));

    expect(telasAoLado.length).toBeGreaterThan(0);
    for (const tela of telasAoLado) expect(SLUGS_RESERVADOS_DE_EMPRESA).toContain(tela);
  });

  it('não deve deixar "nova" ser lida como o slug de uma empresa', () => {
    // A rota do cadastro vem antes da de contexto; ao contrário, "nova" abriria
    // o layout da empresa.
    const app = routes.find((r) => r.path === 'app')!.children!;
    const cadastro = app.findIndex((r) => r.path === 'empresas/nova');
    const edicao = app.findIndex((r) => r.path === 'empresas/:companySlug/editar');
    const contexto = app.findIndex((r) => r.path === 'empresas/:companySlug');
    expect(cadastro).toBeGreaterThanOrEqual(0);
    expect(edicao).toBeGreaterThanOrEqual(0);
    expect(cadastro).toBeLessThan(contexto);
    expect(edicao).toBeLessThan(contexto);
  });
});
