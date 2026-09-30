/**
 * PAP — Pontos de Análise de Perigo (docs/produto/03 §5.2, 04 §4): um por
 * conjunto de comando da máquina, com três seções e os mesmos seis quesitos em
 * cada uma. Cada quesito se responde em duas dimensões independentes.
 */

import type { RecognitionPhoto } from './dto';

/**
 * Um quesito respondido. Nulo = ainda sem resposta: o rascunho guarda o que
 * tiver. As duas dimensões são independentes — o botão pode existir e não
 * atender, e o legado as grava separadas.
 */
export interface ChecklistAnswer {
  /** Existe / está assim? */
  physicalState: boolean | null;
  /** Atende à NR-12? */
  nr12Compliant: boolean | null;
}

export type PapSection = 'activation' | 'reset' | 'emergencyStop';

export const PAP_SECTIONS: ReadonlyArray<{ key: PapSection; label: string }> = [
  { key: 'activation', label: 'Acionamento' },
  { key: 'reset', label: 'Rearme' },
  { key: 'emergencyStop', label: 'Parada de Emergência' },
];

export type PapCriterion = 'installed' | 'accidental' | 'antiFraud' | 'safeArea' | 'extraLowVoltage' | 'portuguese';

/** Os seis quesitos, na ordem e com o sentido do legado (03 §5.2). */
export const PAP_CRITERIA: ReadonlyArray<{ key: PapCriterion; label: string; question: string }> = [
  { key: 'installed', label: 'Instalação', question: 'O dispositivo existe?' },
  { key: 'accidental', label: 'Prevenção de acionamento involuntário', question: 'Tem proteção contra toque acidental?' },
  { key: 'antiFraud', label: 'Antifraude', question: 'É difícil burlar ou travar permanentemente?' },
  { key: 'safeArea', label: 'Área segura', question: 'Aciona sem expor as mãos a partes móveis?' },
  { key: 'extraLowVoltage', label: 'Extrabaixa tensão', question: 'Opera em tensão de comando segura (máx. 24 V)?' },
  { key: 'portuguese', label: 'Sinalização em português', question: 'A identificação é clara e legível?' },
];

export type PapAnswers = Record<PapCriterion, ChecklistAnswer>;

export interface PapSectionDto {
  answers: PapAnswers;
  /** A foto do botão ou do painel daquela seção. */
  photo?: RecognitionPhoto;
}

export interface PapDto {
  id: string;
  /** PAP 1, 2, 3… na análise. Dado pelo servidor; excluir renumera. */
  number: number;
  /** "Painel principal", "Botoeira da descarga". */
  location?: string;
  sections: Record<PapSection, PapSectionDto>;
  violatedStandardIds: string[];
  /** Uma para o conjunto, como no legado. */
  solution?: string;
}

/**
 * Corpo de `PUT …/analyses/:number/paps/:id`, com o id gerado no aparelho.
 * O PAP inteiro: o que não vier é limpo. As fotos vão por rota própria.
 */
export interface PapUpsert {
  location?: string | null;
  sections?: Partial<Record<PapSection, { answers?: Partial<Record<PapCriterion, Partial<ChecklistAnswer>>> }>>;
  violatedStandardIds?: string[];
  solution?: string | null;
}

export function emptyPapAnswers(): PapAnswers {
  return Object.fromEntries(PAP_CRITERIA.map((c) => [c.key, { physicalState: null, nr12Compliant: null }])) as PapAnswers;
}

/** Os quesitos que não atendem à NR-12, nas três seções. É o que o laudo aponta. */
export function papNonConformities(pap: Pick<PapDto, 'sections'>): number {
  return PAP_SECTIONS.reduce(
    (total, s) => total + PAP_CRITERIA.filter((c) => pap.sections[s.key].answers[c.key].nr12Compliant === false).length,
    0,
  );
}
