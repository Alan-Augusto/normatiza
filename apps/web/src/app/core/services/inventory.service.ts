import { HttpClient, HttpParams } from '@angular/common/http';
import { Injectable, inject } from '@angular/core';
import { Observable } from 'rxjs';

import type {
  EquipmentDetail,
  EquipmentDuplicates,
  EquipmentListItem,
  EquipmentListQuery,
  EquipmentUpsertRequest,
  MachineTypeOption,
  SectorCreateResponse,
  SectorListItem,
  SectorUpsertRequest,
} from '@normatiza/shared';

import { API_BASE_URL } from '../auth/api.config';

/**
 * O inventário da planta: equipamentos, setores e o catálogo de tipos
 * (docs/produto/03 §4.2 e §4.3). Tudo sob a empresa, pelo id — a URL da tela
 * traz o slug, e quem o traduz é `empresaDaRota()`. O equipamento é endereçado
 * pelo código (`EQ-0042`).
 */
@Injectable({ providedIn: 'root' })
export class InventoryService {
  private readonly http = inject(HttpClient);
  private readonly api = inject(API_BASE_URL);

  private equipamentos(companyId: string): string {
    return `${this.api}/companies/${companyId}/equipments`;
  }

  private setores(companyId: string): string {
    return `${this.api}/companies/${companyId}/sectors`;
  }

  // ── Equipamentos ─────────────────────────────────────────────────────────

  listEquipments(companyId: string, query: EquipmentListQuery = {}): Observable<EquipmentListItem[]> {
    let params = new HttpParams();
    if (query.q) params = params.set('q', query.q);
    if (query.sectorId) params = params.set('sectorId', query.sectorId);
    if (query.status) params = params.set('status', query.status);
    return this.http.get<EquipmentListItem[]>(this.equipamentos(companyId), { params });
  }

  getEquipment(companyId: string, code: string): Observable<EquipmentDetail> {
    return this.http.get<EquipmentDetail>(`${this.equipamentos(companyId)}/${encodeURIComponent(code)}`);
  }

  createEquipment(companyId: string, dados: EquipmentUpsertRequest): Observable<EquipmentDetail> {
    return this.http.post<EquipmentDetail>(this.equipamentos(companyId), dados);
  }

  updateEquipment(companyId: string, code: string, dados: EquipmentUpsertRequest): Observable<EquipmentDetail> {
    return this.http.patch<EquipmentDetail>(`${this.equipamentos(companyId)}/${code}`, dados);
  }

  deactivateEquipment(companyId: string, code: string): Observable<void> {
    return this.http.post<void>(`${this.equipamentos(companyId)}/${code}/deactivate`, {});
  }

  reactivateEquipment(companyId: string, code: string): Observable<void> {
    return this.http.post<void>(`${this.equipamentos(companyId)}/${code}/reactivate`, {});
  }

  removeEquipment(companyId: string, code: string): Observable<void> {
    return this.http.delete<void>(`${this.equipamentos(companyId)}/${code}`);
  }

  setPhoto(
    companyId: string,
    code: string,
    arquivo: File,
  ): Observable<{ photoUrl: string | null; thumbnailUrl: string | null }> {
    const corpo = new FormData();
    corpo.append('file', arquivo);
    return this.http.put<{ photoUrl: string | null; thumbnailUrl: string | null }>(
      `${this.equipamentos(companyId)}/${code}/photo`,
      corpo,
    );
  }

  removePhoto(companyId: string, code: string): Observable<void> {
    return this.http.delete<void>(`${this.equipamentos(companyId)}/${code}/photo`);
  }

  duplicates(
    companyId: string,
    busca: { serialNumber?: string; patrimonyCode?: string; except?: string },
  ): Observable<EquipmentDuplicates> {
    let params = new HttpParams();
    for (const [chave, valor] of Object.entries(busca)) {
      if (valor?.trim()) params = params.set(chave, valor.trim());
    }
    return this.http.get<EquipmentDuplicates>(`${this.equipamentos(companyId)}/duplicates`, { params });
  }

  // ── Setores ──────────────────────────────────────────────────────────────

  listSectors(companyId: string): Observable<SectorListItem[]> {
    return this.http.get<SectorListItem[]>(this.setores(companyId));
  }

  createSector(companyId: string, dados: SectorUpsertRequest): Observable<SectorCreateResponse> {
    return this.http.post<SectorCreateResponse>(this.setores(companyId), dados);
  }

  updateSector(companyId: string, sectorId: string, dados: SectorUpsertRequest): Observable<SectorListItem> {
    return this.http.patch<SectorListItem>(`${this.setores(companyId)}/${sectorId}`, dados);
  }

  mergeSector(companyId: string, sectorId: string, intoSectorId: string): Observable<void> {
    return this.http.post<void>(`${this.setores(companyId)}/${sectorId}/merge`, { intoSectorId });
  }

  removeSector(companyId: string, sectorId: string): Observable<void> {
    return this.http.delete<void>(`${this.setores(companyId)}/${sectorId}`);
  }

  // ── Tipos de máquina ─────────────────────────────────────────────────────

  listMachineTypes(q?: string): Observable<MachineTypeOption[]> {
    const params = q?.trim() ? new HttpParams().set('q', q.trim()) : undefined;
    return this.http.get<MachineTypeOption[]>(`${this.api}/machine-types`, { params });
  }

  createMachineType(name: string): Observable<MachineTypeOption> {
    return this.http.post<MachineTypeOption>(`${this.api}/machine-types`, { name });
  }
}
