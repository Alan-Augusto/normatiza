import { type Route, type Routes } from '@angular/router';
import { describe, expect, it } from 'vitest';
import { routes } from '../../app.routes';
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
  const equipamento = empresa.equipamento('eq-1');
  const { empresa: _e, editarEmpresa: _ed, admin, ...fixos } = ROTAS;
  return [
    ...Object.values(fixos),
    ROTAS.editarEmpresa('emp-1'),
    empresa.painel,
    empresa.equipamentos,
    empresa.equipe,
    empresa.planoDeAcao,
    equipamento.painel,
    equipamento.analise,
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
    expect(ROTAS.empresa('emp-1').equipamento('eq-1').analise).toBe(
      '/app/empresas/emp-1/equipamentos/eq-1/analise',
    );
    expect(ROTAS.editarEmpresa('emp-1')).toBe('/app/empresas/emp-1/editar');
  });

  it('não deve deixar "nova" ser lida como o id de uma empresa', () => {
    // A rota do cadastro vem antes da de contexto; ao contrário, "nova" abriria
    // o layout da empresa.
    const app = routes.find((r) => r.path === 'app')!.children!;
    const cadastro = app.findIndex((r) => r.path === 'empresas/nova');
    const edicao = app.findIndex((r) => r.path === 'empresas/:companyId/editar');
    const contexto = app.findIndex((r) => r.path === 'empresas/:companyId');
    expect(cadastro).toBeGreaterThanOrEqual(0);
    expect(edicao).toBeGreaterThanOrEqual(0);
    expect(cadastro).toBeLessThan(contexto);
    expect(edicao).toBeLessThan(contexto);
  });
});
