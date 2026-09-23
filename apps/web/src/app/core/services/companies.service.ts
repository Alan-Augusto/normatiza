import { HttpClient, HttpParams } from '@angular/common/http';
import { Injectable, inject } from '@angular/core';
import { Observable } from 'rxjs';

import type {
  CompanyDetail,
  CompanyGroupOption,
  CompanyListItem,
  CompanyListQuery,
  CompanyUpsertRequest,
  CompanyView,
} from '@normatiza/shared';

import { API_BASE_URL } from '../auth/api.config';

/**
 * O cadastro de empresas.
 *
 * Em `core/` e não dentro da feature porque dois lugares o usam: a carteira e
 * o formulário, no Contexto 1, e o diálogo de dados da empresa, que abre da
 * sidebar em qualquer tela do Contexto 2.
 *
 * Nada aqui decide alçada: cada linha e cada detalhe chegam com `actions`.
 */
@Injectable({ providedIn: 'root' })
export class CompaniesService {
  private readonly http = inject(HttpClient);
  private readonly api = inject(API_BASE_URL);

  list(query: CompanyListQuery = {}): Observable<CompanyListItem[]> {
    // Filtro não escolhido não vira parâmetro: `?status=` vazio seria um valor
    // fora do conjunto, e a resposta, um 400 numa lista que ninguém filtrou.
    let params = new HttpParams();
    if (query.q?.trim()) params = params.set('q', query.q.trim());
    if (query.status) params = params.set('status', query.status);
    return this.http.get<CompanyListItem[]>(`${this.api}/companies`, { params });
  }

  get(companyId: string): Observable<CompanyView> {
    return this.http.get<CompanyView>(`${this.api}/companies/${companyId}`);
  }

  create(dados: CompanyUpsertRequest): Observable<CompanyDetail> {
    return this.http.post<CompanyDetail>(`${this.api}/companies`, dados);
  }

  update(companyId: string, dados: CompanyUpsertRequest): Observable<CompanyDetail> {
    return this.http.patch<CompanyDetail>(`${this.api}/companies/${companyId}`, dados);
  }

  deactivate(companyId: string): Observable<void> {
    return this.http.post<void>(`${this.api}/companies/${companyId}/deactivate`, {});
  }

  reactivate(companyId: string): Observable<void> {
    return this.http.post<void>(`${this.api}/companies/${companyId}/reactivate`, {});
  }

  setLogo(companyId: string, arquivo: File): Observable<{ logoUrl: string | null }> {
    const corpo = new FormData();
    corpo.append('file', arquivo);
    return this.http.put<{ logoUrl: string | null }>(`${this.api}/companies/${companyId}/logo`, corpo);
  }

  removeLogo(companyId: string): Observable<void> {
    return this.http.delete<void>(`${this.api}/companies/${companyId}/logo`);
  }

  listGroups(q?: string): Observable<CompanyGroupOption[]> {
    const params = q?.trim() ? new HttpParams().set('q', q.trim()) : undefined;
    return this.http.get<CompanyGroupOption[]>(`${this.api}/company-groups`, { params });
  }
}
