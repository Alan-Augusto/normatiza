import type { HrnTable } from './hrn';

/**
 * O pacote de catálogos da análise: tudo que o formulário escolhe, numa
 * resposta só (`GET /catalogs/analysis`). É lido uma vez e guardado — e é o
 * mesmo que o app de campo vai baixar para trabalhar sem internet.
 */

export interface StandardItemDto {
  id: string;
  itemCode: string;
  text: string;
}

export interface StandardSectionDto {
  id: string;
  norm: string;
  name: string;
  standards: StandardItemDto[];
}

export interface CatalogItemDto {
  id: string;
  name: string;
}

export interface HazardTypeDto {
  id: string;
  name: string;
  origins: CatalogItemDto[];
  consequences: CatalogItemDto[];
}

export interface ProtectionTypeDto {
  id: string;
  name: string;
  protections: CatalogItemDto[];
}

export interface AnalysisCatalogsDto {
  /** Muda quando qualquer catálogo muda: é o `ETag` da resposta. */
  version: string;
  standardSections: StandardSectionDto[];
  hazardTypes: HazardTypeDto[];
  protectionTypes: ProtectionTypeDto[];
  /** A versão vigente, com que a análise nova é calculada. */
  hrnTable: HrnTable;
}
