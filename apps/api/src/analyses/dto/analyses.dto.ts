import { applyDecorators } from '@nestjs/common';
import { Transform, Type } from 'class-transformer';
import {
  ArrayMaxSize,
  IsArray,
  IsBoolean,
  IsIn,
  IsNumber,
  IsOptional,
  IsString,
  IsUUID,
  Max,
  MaxLength,
  Min,
  ValidateNested,
} from 'class-validator';
import type {
  AnalysisCreateRequest,
  AnalysisSheetUpdate,
  ChecklistAnswer,
  HrnFactors,
  PapUpsert,
  PeUpsert,
  RiskPointUpsert,
  SafetyCategoryAnswers,
  SafetyManagement,
} from '@normatiza/shared';

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

/** Os quatro pesos. Se cada um existe na tabela da análise, quem confere é o serviço (D12). */
class HrnFactorsDto implements HrnFactors {
  @IsNumber() fe: number;
  @IsNumber() pe: number;
  @IsNumber() mpl: number;
  @IsNumber() np: number;
}

class SafetyCategoryDto implements SafetyCategoryAnswers {
  @IsIn([1, 2]) severity: 1 | 2;
  @IsOptional() @IsIn([1, 2]) frequency?: 1 | 2;
  @IsOptional() @IsIn([1, 2]) possibility?: 1 | 2;
}

/** Um ponto chega a citar mais de cem itens de norma (o legado tem um com 134). */
const MÁXIMO_DA_LISTA = 300;

/** Lista de ids do catálogo, opcional. Se cada id existe, quem confere é o serviço (D13). */
const ListaDeIds = () => applyDecorators(IsOptional(), IsArray(), ArrayMaxSize(MÁXIMO_DA_LISTA), IsString({ each: true }));

export class RiskPointUpsertDto implements RiskPointUpsert {
  @opcional()
  @IsOptional()
  @IsString()
  @MaxLength(200)
  location?: string | null;

  @ListaDeIds()
  hazardOriginIds?: string[];

  @ListaDeIds()
  hazardConsequenceIds?: string[];

  @ListaDeIds()
  existingProtectionIds?: string[];

  @ListaDeIds()
  violatedStandardIds?: string[];

  @IsOptional()
  @ValidateNested()
  @Type(() => HrnFactorsDto)
  hrn?: HrnFactorsDto | null;

  @IsOptional()
  @ValidateNested()
  @Type(() => SafetyCategoryDto)
  safetyCategory?: SafetyCategoryDto | null;

  @opcional()
  @IsOptional()
  @IsString()
  @MaxLength(5000)
  suggestedSolution?: string | null;
}

/** Um quesito: cada dimensão é sim ou não. O que não vier é "Não", como no legado. */
class ChecklistAnswerDto implements Partial<ChecklistAnswer> {
  @IsOptional() @IsBoolean() physicalState?: boolean;
  @IsOptional() @IsBoolean() nr12Compliant?: boolean;
}

const Quesito = () => applyDecorators(IsOptional(), ValidateNested(), Type(() => ChecklistAnswerDto));

class PapAnswersDto {
  @Quesito() installed?: ChecklistAnswerDto;
  @Quesito() safeArea?: ChecklistAnswerDto;
  @Quesito() accidental?: ChecklistAnswerDto;
  @Quesito() antiFraud?: ChecklistAnswerDto;
  @Quesito() portuguese?: ChecklistAnswerDto;
  @Quesito() ebt?: ChecklistAnswerDto;
}

class PapSectionInputDto {
  @IsOptional()
  @ValidateNested()
  @Type(() => PapAnswersDto)
  answers?: PapAnswersDto;
}

const Seção = () => applyDecorators(IsOptional(), ValidateNested(), Type(() => PapSectionInputDto));

class PapSectionsDto {
  @Seção() activation?: PapSectionInputDto;
  @Seção() stop?: PapSectionInputDto;
  @Seção() reset?: PapSectionInputDto;
}

export class PapUpsertDto implements PapUpsert {
  @opcional()
  @IsOptional()
  @IsString()
  @MaxLength(200)
  location?: string | null;

  @IsOptional()
  @ValidateNested()
  @Type(() => PapSectionsDto)
  sections?: PapSectionsDto;

  @ListaDeIds()
  violatedStandardIds?: string[];

  @opcional()
  @IsOptional()
  @IsString()
  @MaxLength(5000)
  solution?: string | null;
}

class PeAnswersDto {
  @Quesito() installedDevices?: ChecklistAnswerDto;
  @Quesito() startupDevice?: ChecklistAnswerDto;
  @Quesito() triggeredByAnother?: ChecklistAnswerDto;
  @Quesito() antiFraud?: ChecklistAnswerDto;
  @Quesito() portuguese?: ChecklistAnswerDto;
  @Quesito() manualReset?: ChecklistAnswerDto;
  @Quesito() retention?: ChecklistAnswerDto;
  @Quesito() lowVoltage?: ChecklistAnswerDto;
}

export class PeUpsertDto implements PeUpsert {
  @opcional()
  @IsOptional()
  @IsString()
  @MaxLength(200)
  location?: string | null;

  @IsOptional()
  @ValidateNested()
  @Type(() => PeAnswersDto)
  answers?: PeAnswersDto;

  @ListaDeIds()
  violatedStandardIds?: string[];

  @opcional()
  @IsOptional()
  @IsString()
  @MaxLength(5000)
  solution?: string | null;
}
