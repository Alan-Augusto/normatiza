import { HttpClient } from '@angular/common/http';
import { Injectable, inject } from '@angular/core';
import { Observable, shareReplay } from 'rxjs';

import type { AnalysisCatalogsDto } from '@normatiza/shared';

import { API_BASE_URL } from '../auth/api.config';

/**
 * Os catálogos da análise — normas, perigos, proteções e a tabela HRN
 * (`GET /catalogs/analysis`). Mil itens que mudam quase nunca: uma leitura por
 * sessão, compartilhada por quem pedir, e o navegador confere a versão pelo
 * `ETag` quando a página recarrega.
 */
@Injectable({ providedIn: 'root' })
export class CatalogsService {
  private readonly http = inject(HttpClient);
  private readonly api = inject(API_BASE_URL);
  private pacote?: Observable<AnalysisCatalogsDto>;

  analysis(): Observable<AnalysisCatalogsDto> {
    // Uma falha não fica guardada: o `shareReplay` recomeça depois de um erro,
    // e a próxima tela que pedir tenta de novo.
    this.pacote ??= this.http.get<AnalysisCatalogsDto>(`${this.api}/catalogs/analysis`).pipe(
      shareReplay({ bufferSize: 1, refCount: false }),
    );
    return this.pacote;
  }
}
