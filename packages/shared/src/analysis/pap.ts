/**
 * PAP — dispositivos de Partida, Acionamento e Parada (docs/produto/03 §5.2,
 * 04 §4): um por conjunto de comando da máquina, com três seções e os mesmos
 * seis quesitos em cada uma. Nomes, ordem e textos são os da tela do legado:
 * as respostas migradas precisam significar o mesmo.
 */

import type { RecognitionPhoto } from './dto';

/** O nome por extenso, para quem não conhece a sigla. */
export const PAP_NAME = 'Partida, acionamento e parada';

/**
 * Um quesito respondido nas duas dimensões do legado, cada uma sim ou não.
 * Nasce "Não" e "Não atende": quem avalia marca o que de fato é "Sim" ou
 * "Atende" — e o que ficou sem olhar sai como não conformidade, não calado.
 */
export interface ChecklistAnswer {
  /** A afirmação do quesito vale para o dispositivo? */
  physicalState: boolean;
  /** Atende à NR-12? */
  nr12Compliant: boolean;
}

export type PapSection = 'activation' | 'stop' | 'reset';

export const PAP_SECTIONS: ReadonlyArray<{ key: PapSection; label: string }> = [
  { key: 'activation', label: 'Partida' },
  { key: 'stop', label: 'Parada' },
  { key: 'reset', label: 'Rearme' },
];

export type PapCriterion = 'installed' | 'safeArea' | 'accidental' | 'antiFraud' | 'portuguese' | 'ebt';

/**
 * Os seis quesitos, com o texto do legado. Atenção ao sentido: em "Passível de
 * acionamento acidental" e "Passível de burla", "Sim" é o ruim.
 */
export const PAP_CRITERIA: ReadonlyArray<{ key: PapCriterion; label: string }> = [
  { key: 'installed', label: 'Instalado' },
  { key: 'safeArea', label: 'Localizado em zona segura' },
  { key: 'accidental', label: 'Passível de acionamento acidental' },
  { key: 'antiFraud', label: 'Passível de burla' },
  { key: 'portuguese', label: 'Está identificado em língua portuguesa' },
  { key: 'ebt', label: 'Acionado em EBT ou por dupla isolação' },
];

/** O item de norma de onde saem as normas do PAP: 12.4, como no legado. */
export const PAP_STANDARD_SECTION = '12.4';

export type PapAnswers = Record<PapCriterion, ChecklistAnswer>;

export interface PapSectionDto {
  answers: PapAnswers;
  /**
   * A foto do dispositivo daquela seção. É ela que diz que a seção foi
   * avaliada: sem foto, o laudo não traz a seção (como no legado).
   */
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
 * O PAP inteiro: o que não vier é limpo (volta a "Não"). As fotos vão por
 * rota própria.
 */
export interface PapUpsert {
  location?: string | null;
  sections?: Partial<Record<PapSection, { answers?: Partial<Record<PapCriterion, Partial<ChecklistAnswer>>> }>>;
  violatedStandardIds?: string[];
  solution?: string | null;
}

export function emptyPapAnswers(): PapAnswers {
  return Object.fromEntries(PAP_CRITERIA.map((c) => [c.key, { physicalState: false, nr12Compliant: false }])) as PapAnswers;
}

/** As seções avaliadas: as que têm foto. */
export function papAssessedSections(pap: Pick<PapDto, 'sections'>): PapSection[] {
  return PAP_SECTIONS.filter((s) => !!pap.sections[s.key].photo).map((s) => s.key);
}

/** Os quesitos que não atendem à NR-12, nas seções avaliadas. É o que o laudo aponta. */
export function papNonConformities(pap: Pick<PapDto, 'sections'>): number {
  return papAssessedSections(pap).reduce(
    (total, s) => total + PAP_CRITERIA.filter((c) => !pap.sections[s].answers[c.key].nr12Compliant).length,
    0,
  );
}
