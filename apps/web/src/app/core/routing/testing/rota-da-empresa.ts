import { ActivatedRoute, convertToParamMap } from '@angular/router';
import { of } from 'rxjs';

import { PARAMETRO_DA_EMPRESA } from '../empresa-da-rota';

/**
 * Um `ActivatedRoute` de tela do Contexto 2, com o slug na URL como o roteador
 * o entrega. Tem `pathFromRoot` porque é por ele que `empresaDaRota()` procura
 * o parâmetro, na profundidade que for.
 */
export function rotaDaEmpresa(slug: string): ActivatedRoute {
  const params = { [PARAMETRO_DA_EMPRESA]: slug };
  const rota: Record<string, unknown> = {
    paramMap: of(convertToParamMap(params)),
    snapshot: { paramMap: convertToParamMap(params) },
  };
  rota['pathFromRoot'] = [rota];
  return rota as unknown as ActivatedRoute;
}
