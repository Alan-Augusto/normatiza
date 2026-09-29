import type { EquipmentDetail, EquipmentListItem } from '@normatiza/shared';

/** Máquinas do elenco, como a API as devolve. */

export const PODE_TUDO = { edit: true, deactivate: true, reactivate: false, delete: true };
export const SÓ_LÊ = { edit: false, deactivate: false, reactivate: false, delete: false };

export function linhaDeEquipamento(over: Partial<EquipmentListItem> = {}): EquipmentListItem {
  return {
    code: 'EQ-0001',
    name: 'Prensa excêntrica 60t',
    machineType: { id: 'mt-prensa-excentrica', name: 'Prensa excêntrica', global: true },
    tag: 'PR-01',
    sector: { id: 'sec-estamparia', name: 'Estamparia' },
    status: 'ACTIVE',
    complianceStatus: 'NOT_ASSESSED',
    openPointsCount: 0,
    actions: PODE_TUDO,
    ...over,
  };
}

export function detalheDeEquipamento(over: Partial<EquipmentDetail> = {}): EquipmentDetail {
  return {
    ...linhaDeEquipamento(),
    id: 'eq-id-1',
    model: 'PE-60',
    manufacturerName: 'Metalúrgica Sul',
    serialNumber: 'SN-1234',
    manufactureYear: 2012,
    patrimonyCode: 'PAT-77',
    sheet: {
      purpose: 'Estampagem de chapas',
      productiveCapacity: '30 golpes/min',
      powerKw: 7.5,
      controlStations: 1,
      exposedOperators: 2,
      energySources: ['ELECTRIC', 'PNEUMATIC'],
      dimensions: { heightMm: 2400, widthMm: 1200, depthMm: 1500, weightKg: 4200 },
      manufacturer: { document: '11222333000181', city: 'Joinville' },
    },
    createdAt: '2026-09-28T12:00:00.000Z',
    ...over,
  };
}
