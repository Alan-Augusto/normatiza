/**
 * Contratos da análise de risco (docs/produto/03 §5.2, 04 §4).
 * A análise mora no equipamento e é endereçada pelo número dela ali:
 * `/companies/:companyId/equipments/:code/analyses/:number`.
 */

import type { Role } from '../auth';
import type { PersonRef } from '../team/dto';

/**
 * Criam e editam a análise — só a consultoria (01 §7). É a garantia técnica de
 * que o cliente nunca toca na apreciação de riscos. Concluir é dos que assinam
 * (`SIGNING_ROLES`).
 */
export const ANALYSIS_EDITOR_ROLES: readonly Role[] = ['LEAD_ENGINEER', 'CONSULTANT_ENGINEER', 'TECHNICIAN'];

export type AnalysisStatus = 'DRAFT' | 'CONCLUDED';

export const ANALYSIS_STATUS_LABEL: Readonly<Record<AnalysisStatus, string>> = {
  DRAFT: 'Rascunho',
  CONCLUDED: 'Concluída',
};

/** As quatro vistas que cercam a máquina no chão da fábrica. */
export type RecognitionView = 'front' | 'leftSide' | 'rightSide' | 'rear';

export const RECOGNITION_VIEWS: readonly RecognitionView[] = ['front', 'leftSide', 'rightSide', 'rear'];

export const RECOGNITION_VIEW_LABEL: Readonly<Record<RecognitionView, string>> = {
  front: 'Frontal',
  leftSide: 'Lateral esquerda',
  rightSide: 'Lateral direita',
  rear: 'Posterior',
};

export type SafetyManagementQuestion =
  | 'maintenancePlannedByQualifiedProfessional'
  | 'maintenanceRecorded'
  | 'maintenanceRecordsAvailable'
  | 'hasInstructionManual'
  | 'hasWorkAndSafetyProcedures'
  | 'workersTrained';

/**
 * As seis perguntas de gestão de segurança, na ordem e com o texto do legado
 * (03 §5.2): as respostas migradas precisam significar o mesmo.
 */
export const SAFETY_MANAGEMENT_QUESTIONS: ReadonlyArray<{ key: SafetyManagementQuestion; text: string }> = [
  {
    key: 'maintenancePlannedByQualifiedProfessional',
    text: 'As manutenções preventivas com potencial de causar acidentes do trabalho são objeto de planejamento e gerenciamento efetuado por profissional legalmente habilitado?',
  },
  {
    key: 'maintenanceRecorded',
    text: 'As manutenções preventivas e corretivas são registradas em livro próprio, ficha ou sistema informatizado — cronograma, intervenções realizadas, data de cada intervenção, serviço realizado, peças reparadas ou substituídas, condições de segurança do equipamento, indicação conclusiva quanto às condições de segurança da máquina e nome do responsável pelas intervenções?',
  },
  {
    key: 'maintenanceRecordsAvailable',
    text: 'O registro das manutenções está disponível aos trabalhadores envolvidos na operação, manutenção e reparos, à CIPA, ao SESMT e à fiscalização do Ministério do Trabalho e Emprego?',
  },
  {
    key: 'hasInstructionManual',
    text: 'As máquinas e equipamentos possuem manual de instruções fornecido pelo fabricante ou importador, com informações relativas à segurança em todas as fases de utilização?',
  },
  {
    key: 'hasWorkAndSafetyProcedures',
    text: 'A máquina possui procedimentos de trabalho e segurança específicos, padronizados, com descrição detalhada de cada tarefa, passo a passo, a partir da análise de risco?',
  },
  {
    key: 'workersTrained',
    text: 'Os trabalhadores envolvidos na operação, manutenção, inspeção e demais intervenções possuem capacitação providenciada pelo empregador, compatível com suas funções, que aborde os riscos a que estão expostos e as medidas de proteção existentes e necessárias?',
  },
];

/** Sim, não, ou ainda sem resposta — o rascunho guarda o que tiver. */
export type SafetyManagement = Record<SafetyManagementQuestion, boolean | null>;

/** O que se mede na vistoria. Tudo opcional no rascunho. */
export interface AnalysisSheet {
  times: {
    cycleTimeSec?: number;
    activationTimeSec?: number;
    emergencyStopTimeSec?: number;
  };
  /** O regime de uso observado: turnos, horas por dia. */
  shiftRegime?: string;
  safetyManagement: SafetyManagement;
}

export interface AnalysisActions {
  edit: boolean;
  /** Só rascunho se descarta. */
  discard: boolean;
}

/** Uma linha de `GET …/analyses`. Os números de risco chegam com os pontos. */
export interface AnalysisListItem {
  id: string;
  number: number;
  revision: number;
  status: AnalysisStatus;
  startedAt: string;
  concludedAt?: string;
  fieldTechnician?: PersonRef;
  responsibleEngineer?: PersonRef;
  actions: AnalysisActions;
}

export interface RecognitionPhoto {
  url: string;
  thumbnailUrl: string;
}

export interface AnalysisDetail extends AnalysisListItem {
  norm: string;
  hrnTableVersionId: string;
  artNumber?: string;
  sheet: AnalysisSheet;
  photos: Partial<Record<RecognitionView, RecognitionPhoto>>;
}

/**
 * Corpo de `POST …/analyses`. `id` é o do aparelho (UUID): reenviar a mesma
 * criação devolve a análise que já nasceu, em vez de uma segunda.
 */
export interface AnalysisCreateRequest {
  id?: string;
}

/**
 * Corpo de `PUT …/analyses/:number/sheet` — a etapa 1 inteira: o que não vier
 * é limpo, como no cadastro do equipamento.
 */
export interface AnalysisSheetUpdate {
  /** Uma pessoa da consultoria alocada na empresa. */
  fieldTechnicianUserId?: string | null;
  times?: AnalysisSheet['times'];
  shiftRegime?: string | null;
  safetyManagement?: Partial<SafetyManagement>;
}

export function emptySafetyManagement(): SafetyManagement {
  return Object.fromEntries(SAFETY_MANAGEMENT_QUESTIONS.map((q) => [q.key, null])) as SafetyManagement;
}
