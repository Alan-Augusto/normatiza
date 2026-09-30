import { HttpClient } from '@angular/common/http';
import { Injectable, inject } from '@angular/core';
import { Observable } from 'rxjs';

import type {
  AnalysisCreateRequest,
  AnalysisDetail,
  AnalysisListItem,
  AnalysisSheetUpdate,
  PersonRef,
  RecognitionPhoto,
  RecognitionView,
} from '@normatiza/shared';

import { API_BASE_URL } from '../auth/api.config';

/**
 * A análise de risco (docs/produto/03 §5.2). Mora no equipamento — pelo código
 * dele — e se endereça pelo número: `EQ-0042 · Análise 2`.
 */
@Injectable({ providedIn: 'root' })
export class AnalysisService {
  private readonly http = inject(HttpClient);
  private readonly api = inject(API_BASE_URL);

  private base(companyId: string, code: string): string {
    return `${this.api}/companies/${companyId}/equipments/${encodeURIComponent(code)}/analyses`;
  }

  list(companyId: string, code: string): Observable<AnalysisListItem[]> {
    return this.http.get<AnalysisListItem[]>(this.base(companyId, code));
  }

  get(companyId: string, code: string, number: number): Observable<AnalysisDetail> {
    return this.http.get<AnalysisDetail>(`${this.base(companyId, code)}/${number}`);
  }

  create(companyId: string, code: string, dados: AnalysisCreateRequest = {}): Observable<AnalysisDetail> {
    return this.http.post<AnalysisDetail>(this.base(companyId, code), dados);
  }

  fieldTechnicians(companyId: string, code: string): Observable<PersonRef[]> {
    return this.http.get<PersonRef[]>(`${this.base(companyId, code)}/field-technicians`);
  }

  updateSheet(companyId: string, code: string, number: number, dados: AnalysisSheetUpdate): Observable<AnalysisDetail> {
    return this.http.put<AnalysisDetail>(`${this.base(companyId, code)}/${number}/sheet`, dados);
  }

  setPhoto(companyId: string, code: string, number: number, view: RecognitionView, arquivo: File): Observable<RecognitionPhoto> {
    const corpo = new FormData();
    corpo.append('file', arquivo);
    return this.http.put<RecognitionPhoto>(`${this.base(companyId, code)}/${number}/photos/${view}`, corpo);
  }

  removePhoto(companyId: string, code: string, number: number, view: RecognitionView): Observable<void> {
    return this.http.delete<void>(`${this.base(companyId, code)}/${number}/photos/${view}`);
  }

  discard(companyId: string, code: string, number: number): Observable<void> {
    return this.http.delete<void>(`${this.base(companyId, code)}/${number}`);
  }
}
