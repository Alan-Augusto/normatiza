import { Transform, Type } from 'class-transformer';
import { IsBoolean, IsNumber, IsOptional, IsString, IsUUID, Max, MaxLength, Min, ValidateNested } from 'class-validator';
import type { AnalysisCreateRequest, AnalysisSheetUpdate, SafetyManagement } from '@normatiza/shared';

/**
 * O formato de entrada da análise. O que depende do banco — o técnico ser da
 * consultoria alocada, a análise ser rascunho — é do serviço.
 */

/** Opcional vazio é ausente: `""` no regime não é um regime. */
const opcional = () =>
  Transform(({ value }) => {
    if (typeof value !== 'string') return value;
    const limpo = value.replace(/\s+/g, ' ').trim();
    return limpo === '' ? null : limpo;
  });

/** Um dia inteiro, em segundos, com folga: tempo de máquina maior que isso é erro de digitação. */
const TEMPO_MÁXIMO = 100_000;

export class AnalysisCreateDto implements AnalysisCreateRequest {
  @IsOptional()
  @IsUUID('4', { message: 'O id gerado no aparelho precisa ser um UUID.' })
  id?: string;
}

class AnalysisTimesDto {
  @IsOptional()
  @IsNumber()
  @Min(0)
  @Max(TEMPO_MÁXIMO)
  cycleTimeSec?: number;

  @IsOptional()
  @IsNumber()
  @Min(0)
  @Max(TEMPO_MÁXIMO)
  activationTimeSec?: number;

  @IsOptional()
  @IsNumber()
  @Min(0)
  @Max(TEMPO_MÁXIMO)
  emergencyStopTimeSec?: number;
}

/** Sim, não ou nulo (ainda sem resposta) em cada uma das seis perguntas. */
class SafetyManagementDto implements Partial<SafetyManagement> {
  @IsOptional() @IsBoolean() maintenancePlannedByQualifiedProfessional?: boolean | null;
  @IsOptional() @IsBoolean() maintenanceRecorded?: boolean | null;
  @IsOptional() @IsBoolean() maintenanceRecordsAvailable?: boolean | null;
  @IsOptional() @IsBoolean() hasInstructionManual?: boolean | null;
  @IsOptional() @IsBoolean() hasWorkAndSafetyProcedures?: boolean | null;
  @IsOptional() @IsBoolean() workersTrained?: boolean | null;
}

export class AnalysisSheetUpdateDto implements AnalysisSheetUpdate {
  @IsOptional()
  @IsString()
  fieldTechnicianUserId?: string | null;

  @IsOptional()
  @ValidateNested()
  @Type(() => AnalysisTimesDto)
  times?: AnalysisTimesDto;

  @opcional()
  @IsOptional()
  @IsString()
  @MaxLength(200)
  shiftRegime?: string | null;

  @IsOptional()
  @ValidateNested()
  @Type(() => SafetyManagementDto)
  safetyManagement?: SafetyManagementDto;
}
