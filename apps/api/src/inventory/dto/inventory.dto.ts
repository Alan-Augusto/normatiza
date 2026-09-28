import { Transform, Type } from 'class-transformer';
import { IsIn, IsInt, IsNotEmpty, IsOptional, IsString, MaxLength, ValidateIf } from 'class-validator';
import type {
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
