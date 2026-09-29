import { Transform, Type } from 'class-transformer';
import {
  IsArray,
  IsIn,
  IsInt,
  IsNotEmpty,
  IsNumber,
  IsOptional,
  IsString,
  Matches,
  Max,
  MaxLength,
  Min,
  ValidateIf,
  ValidateNested,
} from 'class-validator';
import { ENERGY_SOURCES } from '@normatiza/shared';
import type {
  EnergySource,
  EquipmentSheet,
  EquipmentListQuery,
  EquipmentStatus,
  EquipmentUpsertRequest,
  MachineTypeCreateRequest,
  SectorMergeRequest,
  SectorUpsertRequest,
} from '@normatiza/shared';

/**
 * O formato de entrada do inventário. O que depende do banco — setor da
 * empresa, tipo da conta, TAG livre — é do serviço.
 */

const obrigatório = '$property é obrigatório.';

/** Apara antes de validar: um nome só de espaços não é nome. */
const aparado = () =>
  Transform(({ value }) => (typeof value === 'string' ? value.replace(/\s+/g, ' ').trim() : value));

/** Opcional vazio é ausente: `""` na TAG não é uma TAG. */
const opcional = () =>
  Transform(({ value }) => {
    if (typeof value !== 'string') return value;
    const limpo = value.replace(/\s+/g, ' ').trim();
    return limpo === '' ? undefined : limpo;
  });

export class MachineTypeCreateDto implements MachineTypeCreateRequest {
  @aparado()
  @IsString()
  @IsNotEmpty({ message: obrigatório })
  @MaxLength(80)
  name: string;
}

export class MachineTypeQueryDto {
  @opcional()
  @IsOptional()
  @IsString()
  @MaxLength(80)
  q?: string;
}

export class SectorUpsertDto implements SectorUpsertRequest {
  @aparado()
  @IsString()
  @IsNotEmpty({ message: obrigatório })
  @MaxLength(80)
  name: string;

  @opcional()
  @IsOptional()
  @IsString()
  @MaxLength(500)
  description?: string;

  @IsOptional()
  @ValidateIf((_, v) => v !== null)
  @IsString()
  responsibleUserId?: string | null;
}

export class SectorMergeDto implements SectorMergeRequest {
  @IsString()
  @IsNotEmpty({ message: obrigatório })
  intoSectorId: string;
}

/** Limites de sanidade, não de engenharia: pegam o zero a mais digitado, não a máquina grande. */
class EquipmentDimensionsDto {
  @IsOptional() @IsInt() @Min(1) @Max(100_000) heightMm?: number;
  @IsOptional() @IsInt() @Min(1) @Max(100_000) widthMm?: number;
  @IsOptional() @IsInt() @Min(1) @Max(100_000) depthMm?: number;
  @IsOptional() @IsNumber() @Min(0) @Max(1_000_000) weightKg?: number;
}

class EquipmentManufacturerDto {
  /** O dígito verificador é conferido no serviço, que responde no campo. */
  @opcional() @IsOptional() @IsString() @MaxLength(18) document?: string;
  @opcional() @IsOptional() @IsString() @MaxLength(60) registry?: string;
  @opcional() @IsOptional() @IsString() @MaxLength(200) address?: string;
  @opcional() @IsOptional() @IsString() @MaxLength(120) city?: string;
  @opcional()
  @IsOptional()
  @Matches(/^\d{5}-?\d{3}$/, { message: 'O CEP do fabricante precisa ter 8 dígitos.' })
  zipCode?: string;
}

class EquipmentSheetDto implements Partial<EquipmentSheet> {
  @opcional() @IsOptional() @IsString() @MaxLength(200) purpose?: string;
  @opcional() @IsOptional() @IsString() @MaxLength(200) productiveCapacity?: string;
  @IsOptional() @IsNumber() @Min(0) @Max(100_000) powerKw?: number;
  @IsOptional() @IsInt() @Min(0) @Max(1_000) controlStations?: number;
  @IsOptional() @IsInt() @Min(0) @Max(10_000) exposedOperators?: number;

  @IsOptional()
  @IsArray()
  @IsIn(ENERGY_SOURCES, { each: true })
  energySources?: EnergySource[];

  @opcional() @IsOptional() @IsString() @MaxLength(4000) processDescription?: string;
  @opcional() @IsOptional() @IsString() @MaxLength(4000) commonInterventions?: string;
  @opcional() @IsOptional() @IsString() @MaxLength(4000) otherInfo?: string;

  @IsOptional()
  @ValidateNested()
  @Type(() => EquipmentDimensionsDto)
  dimensions?: EquipmentDimensionsDto;

  @IsOptional()
  @ValidateNested()
  @Type(() => EquipmentManufacturerDto)
  manufacturer?: EquipmentManufacturerDto;
}

export class EquipmentUpsertDto implements EquipmentUpsertRequest {
  @aparado()
  @IsString()
  @IsNotEmpty({ message: obrigatório })
  @MaxLength(160)
  name: string;

  @IsOptional()
  @ValidateIf((_, v) => v !== null)
  @IsString()
  machineTypeId?: string | null;

  @opcional()
  @IsOptional()
  @IsString()
  @MaxLength(120)
  model?: string;

  @opcional()
  @IsOptional()
  @IsString()
  @MaxLength(160)
  manufacturerName?: string;

  @opcional()
  @IsOptional()
  @IsString()
  @MaxLength(120)
  serialNumber?: string;

  @IsOptional()
  @ValidateIf((_, v) => v !== null)
  @Type(() => Number)
  @IsInt({ message: 'O ano de fabricação precisa ser um número inteiro.' })
  manufactureYear?: number | null;

  @opcional()
  @IsOptional()
  @IsString()
  @MaxLength(60)
  tag?: string;

  @opcional()
  @IsOptional()
  @IsString()
  @MaxLength(60)
  patrimonyCode?: string;

  @IsOptional()
  @ValidateIf((_, v) => v !== null)
  @IsString()
  sectorId?: string | null;

  @IsOptional()
  @ValidateNested()
  @Type(() => EquipmentSheetDto)
  sheet?: EquipmentSheetDto;
}

export class EquipmentListQueryDto implements EquipmentListQuery {
  @opcional()
  @IsOptional()
  @IsString()
  @MaxLength(120)
  q?: string;

  @opcional()
  @IsOptional()
  @IsString()
  sectorId?: string;

  @IsOptional()
  @IsIn(['ACTIVE', 'INACTIVE', 'ALL'])
  status?: EquipmentStatus | 'ALL';
}

export class EquipmentDuplicatesQueryDto {
  @opcional()
  @IsOptional()
  @IsString()
  @MaxLength(120)
  serialNumber?: string;

  @opcional()
  @IsOptional()
  @IsString()
  @MaxLength(60)
  patrimonyCode?: string;

  @opcional()
  @IsOptional()
  @IsString()
  except?: string;
}
