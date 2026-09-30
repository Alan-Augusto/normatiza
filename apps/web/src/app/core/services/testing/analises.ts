import { emptySafetyManagement, type AnalysisDetail, type AnalysisListItem } from '@normatiza/shared';

/** Análises do elenco, como a API as devolve. */

export const FERNANDO = { id: 'user-fernando', name: 'Fernando' };
export const CARLA = { id: 'user-carla', name: 'Carla' };

export const RASCUNHO_EDITÁVEL = { edit: true, discard: true };
export const SÓ_LEITURA = { edit: false, discard: false };

export function linhaDeAnalise(over: Partial<AnalysisListItem> = {}): AnalysisListItem {
  return {
    id: 'an-1',
    number: 1,
    revision: 1,
    status: 'DRAFT',
    startedAt: '2026-09-30T12:00:00.000Z',
    fieldTechnician: FERNANDO,
    actions: RASCUNHO_EDITÁVEL,
    ...over,
  };
}

export function detalheDeAnalise(over: Partial<AnalysisDetail> = {}): AnalysisDetail {
  return {
    ...linhaDeAnalise(),
    norm: 'NR-12',
    hrnTableVersionId: 'hrn-legado-v1',
    sheet: { times: {}, safetyManagement: emptySafetyManagement() },
    photos: {},
    ...over,
  };
}
