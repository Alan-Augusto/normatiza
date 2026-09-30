import { HttpClient } from '@angular/common/http';
import { Injectable, inject } from '@angular/core';
import { Observable } from 'rxjs';

import type {
  AnalysisCreateRequest,
  AnalysisDetail,
  AnalysisListItem,
  AnalysisSheetUpdate,
  PapDto,
  PapSection,
  PapUpsert,
  PeDto,
  PeUpsert,
  PersonRef,
  RecognitionPhoto,
  RecognitionView,
  RiskPointDto,
  RiskPointUpsert,
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

  /** O ponto inteiro, pelo id gerado aqui: regravar não duplica. */
  saveRiskPoint(companyId: string, code: string, number: number, pointId: string, dados: RiskPointUpsert): Observable<RiskPointDto> {
    return this.http.put<RiskPointDto>(`${this.base(companyId, code)}/${number}/risk-points/${pointId}`, dados);
  }

  removeRiskPoint(companyId: string, code: string, number: number, pointId: string): Observable<void> {
    return this.http.delete<void>(`${this.base(companyId, code)}/${number}/risk-points/${pointId}`);
  }

  setRiskPointPhoto(companyId: string, code: string, number: number, pointId: string, arquivo: File): Observable<RecognitionPhoto> {
    const corpo = new FormData();
    corpo.append('file', arquivo);
    return this.http.put<RecognitionPhoto>(`${this.base(companyId, code)}/${number}/risk-points/${pointId}/photo`, corpo);
  }

  removeRiskPointPhoto(companyId: string, code: string, number: number, pointId: string): Observable<void> {
    return this.http.delete<void>(`${this.base(companyId, code)}/${number}/risk-points/${pointId}/photo`);
  }

  /** O PAP inteiro, pelo id gerado aqui: regravar não duplica. */
  savePap(companyId: string, code: string, number: number, papId: string, dados: PapUpsert): Observable<PapDto> {
    return this.http.put<PapDto>(`${this.base(companyId, code)}/${number}/paps/${papId}`, dados);
  }

  removePap(companyId: string, code: string, number: number, papId: string): Observable<void> {
    return this.http.delete<void>(`${this.base(companyId, code)}/${number}/paps/${papId}`);
  }

  setPapPhoto(companyId: string, code: string, number: number, papId: string, section: PapSection, arquivo: File): Observable<RecognitionPhoto> {
    const corpo = new FormData();
    corpo.append('file', arquivo);
    return this.http.put<RecognitionPhoto>(`${this.base(companyId, code)}/${number}/paps/${papId}/photos/${section}`, corpo);
  }

  removePapPhoto(companyId: string, code: string, number: number, papId: string, section: PapSection): Observable<void> {
    return this.http.delete<void>(`${this.base(companyId, code)}/${number}/paps/${papId}/photos/${section}`);
  }

  /** O PE inteiro, pelo id gerado aqui: regravar não duplica. */
  savePe(companyId: string, code: string, number: number, peId: string, dados: PeUpsert): Observable<PeDto> {
    return this.http.put<PeDto>(`${this.base(companyId, code)}/${number}/pes/${peId}`, dados);
  }

  removePe(companyId: string, code: string, number: number, peId: string): Observable<void> {
    return this.http.delete<void>(`${this.base(companyId, code)}/${number}/pes/${peId}`);
  }

  setPePhoto(companyId: string, code: string, number: number, peId: string, arquivo: File): Observable<RecognitionPhoto> {
    const corpo = new FormData();
    corpo.append('file', arquivo);
    return this.http.put<RecognitionPhoto>(`${this.base(companyId, code)}/${number}/pes/${peId}/photo`, corpo);
  }

  removePePhoto(companyId: string, code: string, number: number, peId: string): Observable<void> {
    return this.http.delete<void>(`${this.base(companyId, code)}/${number}/pes/${peId}/photo`);
  }

  discard(companyId: string, code: string, number: number): Observable<void> {
    return this.http.delete<void>(`${this.base(companyId, code)}/${number}`);
  }
}
