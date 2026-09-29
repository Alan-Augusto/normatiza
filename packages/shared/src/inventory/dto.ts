/**
 * Contratos do inventário: setores, tipos de máquina e equipamentos.
 * Regras: docs/produto/03 §4.2 e §4.3, 04 §2, §3 e §7.
 */

/** Um tipo do catálogo. `global` = da plataforma; senão, acrescentado pela consultoria. */
export interface MachineTypeOption {
  id: string;
  name: string;
  global: boolean;
}

/** Corpo de `POST /machine-types`. Um nome que já existe devolve o existente. */
export interface MachineTypeCreateRequest {
  name: string;
}

export interface SectorOption {
  id: string;
  name: string;
}

export interface SectorActions {
  edit: boolean;
  merge: boolean;
  /** Só o setor sem equipamento se exclui. */
  delete: boolean;
}

/** Uma linha de `GET /companies/:companyId/sectors`. */
export interface SectorListItem extends SectorOption {
  description?: string;
  responsible?: { id: string; name: string };
  equipmentsCount: number;
  actions: SectorActions;
}

/** Corpo de `POST` e `PATCH` de setor. */
export interface SectorUpsertRequest {
  name: string;
  description?: string;
  responsibleUserId?: string | null;
}

/**
 * A resposta da criação. `existing` diz que o nome já existia — sem acento nem
 * caixa — e o setor devolvido é o que já estava lá, não um segundo.
 */
export interface SectorCreateResponse extends SectorListItem {
  existing: boolean;
}

/** Corpo de `POST /companies/:companyId/sectors/:sectorId/merge`: o setor que fica. */
export interface SectorMergeRequest {
  intoSectorId: string;
}

/** As fontes de energia da máquina — o que se isola antes de uma intervenção. */
export type EnergySource = 'ELECTRIC' | 'PNEUMATIC' | 'HYDRAULIC' | 'MECHANICAL' | 'RADIOACTIVE';

export const ENERGY_SOURCES: readonly EnergySource[] = ['ELECTRIC', 'PNEUMATIC', 'HYDRAULIC', 'MECHANICAL', 'RADIOACTIVE'];

export const ENERGY_SOURCE_LABEL: Readonly<Record<EnergySource, string>> = {
  ELECTRIC: 'Elétrica',
  PNEUMATIC: 'Pneumática',
  HYDRAULIC: 'Hidráulica',
  MECHANICAL: 'Mecânica',
  RADIOACTIVE: 'Radioativa',
};

/**
 * A ficha do ativo: características da máquina, não medidas da vistoria
 * (docs/produto/03 §4.2, 04 §3). Tudo opcional — só o nome do equipamento é
 * obrigatório. Os tempos, o regime de uso e a gestão de segurança são da análise.
 */
export interface EquipmentSheet {
  /** "Utilização": para que a máquina serve. */
  purpose?: string;
  /** Texto: "10 t/h", "115200 ovos", "MIN 5,9 CX/MIN". */
  productiveCapacity?: string;
  powerKw?: number;
  /** Postos de comando. */
  controlStations?: number;
  exposedOperators?: number;
  energySources: EnergySource[];
  processDescription?: string;
  /** Intervenções comuns do operador. */
  commonInterventions?: string;
  otherInfo?: string;
  dimensions: { heightMm?: number; widthMm?: number; depthMm?: number; weightKg?: number };
  /** O nome do fabricante é identidade (`manufacturerName`); aqui, o resto do cadastro dele. */
  manufacturer: { document?: string; registry?: string; address?: string; city?: string; zipCode?: string };
}

/** Fora do inventário ou não. Conformidade e risco são das análises, não disto. */
export type EquipmentStatus = 'ACTIVE' | 'INACTIVE';

export const EQUIPMENT_STATUS_LABEL: Readonly<Record<EquipmentStatus, string>> = {
  ACTIVE: 'Ativo',
  INACTIVE: 'Desativado',
};

/** Projeção das análises. Sem análise, `NOT_ASSESSED`. */
export type EquipmentComplianceStatus = 'NOT_ASSESSED' | 'NON_COMPLIANT' | 'IN_ADEQUACY' | 'COMPLIANT';

export const EQUIPMENT_COMPLIANCE_LABEL: Readonly<Record<EquipmentComplianceStatus, string>> = {
  NOT_ASSESSED: 'Sem análise',
  NON_COMPLIANT: 'Não conforme',
  IN_ADEQUACY: 'Em adequação',
  COMPLIANT: 'Conforme',
};

export interface EquipmentActions {
  edit: boolean;
  deactivate: boolean;
  reactivate: boolean;
  /** Só o equipamento que nunca teve análise se exclui. */
  delete: boolean;
}

/** Referência curta a um equipamento — o aviso de série ou patrimônio repetido. */
export interface EquipmentRef {
  code: string;
  name: string;
}

/** Uma linha de `GET /companies/:companyId/equipments`. */
export interface EquipmentListItem extends EquipmentRef {
  machineType?: MachineTypeOption;
  model?: string;
  manufacturerName?: string;
  serialNumber?: string;
  tag?: string;
  patrimonyCode?: string;
  sector?: SectorOption;
  /** A miniatura, nunca o original: é o que o cartão da lista carrega. */
  thumbnailUrl?: string;
  status: EquipmentStatus;
  complianceStatus: EquipmentComplianceStatus;
  /** Ausentes enquanto não há análise: a tela mostra "—". */
  worstCurrentHrn?: number;
  lastAnalysisAt?: string;
  /** Zero é verdade: sem análise, não há ponto em aberto. */
  openPointsCount: number;
  actions: EquipmentActions;
}

/** `GET /companies/:companyId/equipments/:code`. */
export interface EquipmentDetail extends EquipmentListItem {
  id: string;
  manufactureYear?: number;
  sheet: EquipmentSheet;
  /** O original, para o painel do equipamento. */
  photoUrl?: string;
  createdAt: string;
}

/**
 * Filtros da lista. Sem `status`, só os ativos — o inventário em operação;
 * `ALL` inclui os desativados.
 */
export interface EquipmentListQuery {
  q?: string;
  sectorId?: string;
  status?: EquipmentStatus | 'ALL';
}

/** Corpo de `POST` e `PATCH` de equipamento. Obrigatório é só o nome. */
export interface EquipmentUpsertRequest {
  name: string;
  machineTypeId?: string | null;
  model?: string;
  manufacturerName?: string;
  serialNumber?: string;
  manufactureYear?: number | null;
  tag?: string;
  patrimonyCode?: string;
  sectorId?: string | null;
  /** Ausente = ficha vazia. Como a identidade, o que vier vazio é limpo. */
  sheet?: Partial<EquipmentSheet>;
}

/** `GET …/equipments/duplicates`: quem já usa a série ou o patrimônio informados. */
export interface EquipmentDuplicates {
  serialNumber: EquipmentRef[];
  patrimonyCode: EquipmentRef[];
}
