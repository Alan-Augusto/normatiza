/**
 * PE — dispositivos de Parada de Emergência (docs/produto/03 §5.2, 04 §4): um
 * por dispositivo avaliado, com um checklist só, de oito quesitos. Nomes, ordem
 * e textos são os da tela do legado: as respostas migradas precisam significar
 * o mesmo.
 */

import type { RecognitionPhoto } from './dto';
import type { ChecklistAnswer } from './pap';

/** O nome por extenso, para quem não conhece a sigla. */
export const PE_NAME = 'Parada de emergência';

/** O item de norma de onde saem as normas do PE: 12.6, como no legado. */
export const PE_STANDARD_SECTION = '12.6';

export type PeCriterion =
  | 'installedDevices'
  | 'startupDevice'
  | 'triggeredByAnother'
  | 'antiFraud'
  | 'portuguese'
  | 'manualReset'
  | 'retention'
  | 'lowVoltage';

/**
 * Os oito quesitos, com o texto do legado. Em "O dispositivo é usado para
 * partida", "Pode ser acionado por outro operador" e "É passível de burla",
 * "Sim" é o ruim.
 */
export const PE_CRITERIA: ReadonlyArray<{ key: PeCriterion; label: string }> = [
  { key: 'installedDevices', label: 'Há dispositivos de seg. instalados' },
  { key: 'startupDevice', label: 'O dispositivo é usado para partida' },
  { key: 'triggeredByAnother', label: 'Pode ser acionado por outro operador' },
  { key: 'antiFraud', label: 'É passível de burla' },
  { key: 'portuguese', label: 'Está identificado em língua portuguesa' },
  { key: 'manualReset', label: 'Exige rearme manual' },
  { key: 'retention', label: 'Apresenta retenção após acionado' },
  { key: 'lowVoltage', label: 'Acionado em extrabaixa tensão' },
];

export type PeAnswers = Record<PeCriterion, ChecklistAnswer>;

export interface PeDto {
  id: string;
  /** PE 1, 2, 3… na análise. Dado pelo servidor; excluir renumera. */
  number: number;
  location?: string;
  /** No laudo do legado, as respostas do PE saem com ou sem foto. */
  answers: PeAnswers;
  violatedStandardIds: string[];
  solution?: string;
  photo?: RecognitionPhoto;
}

/**
 * Corpo de `PUT …/analyses/:number/pes/:id`, com o id gerado no aparelho.
 * O PE inteiro: o que não vier é limpo (volta a "Não"). A foto vai por rota
 * própria.
 */
export interface PeUpsert {
  location?: string | null;
  answers?: Partial<Record<PeCriterion, Partial<ChecklistAnswer>>>;
  violatedStandardIds?: string[];
  solution?: string | null;
}

export function emptyPeAnswers(): PeAnswers {
  return Object.fromEntries(PE_CRITERIA.map((c) => [c.key, { physicalState: false, nr12Compliant: false }])) as PeAnswers;
}

/** Os quesitos que não atendem à NR-12. É o que o laudo aponta. */
export function peNonConformities(pe: Pick<PeDto, 'answers'>): number {
  return PE_CRITERIA.filter((c) => !pe.answers[c.key].nr12Compliant).length;
}
