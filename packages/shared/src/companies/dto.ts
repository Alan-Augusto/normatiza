/**
 * Contratos de rede do cadastro de empresas.
 *
 * Duas projeções de detalhe, não uma filtrada — o mesmo desenho da Equipe
 * (D15 de docs/planos/gestao-de-equipe.md). `CompanyProfile` é o que o lado
 * cliente recebe; `CompanyDetail` acrescenta o que é da consultoria sobre o
 * cliente: grupo, código interno, observações. O recorte está na **forma do
 * tipo**, e não na diligência de quem monta a tela: um campo que o tipo do
 * cliente não tem não pode vazar por esquecimento no template.
 *
 * Regra de negócio: docs/produto/03_navegacao_e_telas.md §3.2 e §4.0
 */

import type { TechnicalResponsible } from '../team';
import type { CompanyStatus } from './status';

export interface CompanyContact {
  name: string;
  role?: string;
  email: string;
  phone?: string;
  mobile?: string;
}

export interface CompanyAddress {
  /** Só dígitos. */
  zipCode: string;
  street: string;
  number: string;
  complement?: string;
  district: string;
  city: string;
  /** Sigla da UF. */
  state: string;
}

export interface CompanyGroupOption {
  id: string;
  name: string;
}

/**
 * O que **quem está olhando** pode fazer com **esta empresa**. Vem do servidor
 * pelo mesmo motivo da Equipe: a tela não recalcula alçada, e o servidor
 * revalida em toda mutação.
 */
export interface CompanyActions {
  edit: boolean;
  deactivate: boolean;
  reactivate: boolean;
  /**
   * Convidar Gestor — e reenviar o convite dele. É o que leva a empresa a
   * *ativa*, e só o Engenheiro Responsável concede o papel: a Engenheira da
   * Consultoria cadastra a empresa, mas não escolhe quem aprova o orçamento.
   */
  inviteManager: boolean;
}

/**
 * Os números da operação. Existem no contrato desde já — a tela nasce com as
 * colunas —, e passam a se preencher quando equipamentos e análises existirem.
 *
 * Os contadores são `number` porque zero é verdade: não há equipamento
 * nenhum. Os outros dois são opcionais porque sem análise **não há o que
 * medir**, e "0% adequada" afirmaria que nada foi adequado.
 */
export interface CompanyMetrics {
  equipmentsCount: number;
  openPointsCount: number;
  adequacyPercent?: number;
  /** ISO 8601. */
  lastAnalysisAt?: string;
}

/** Um Gestor, como a lista o nomeia. */
export interface CompanyManagerRef {
  id: string;
  name: string;
  /** Ainda não aceitou o convite. */
  pending: boolean;
  /**
   * O convite em aberto de quem ainda não aceitou — o que "reenviar" precisa.
   * `expired` separa "ainda não abriu o e-mail" de "o link já não vale".
   */
  invitation?: { id: string; expired: boolean };
}

/** Uma linha de `GET /companies`. */
export interface CompanyListItem extends CompanyMetrics {
  id: string;
  tradeName: string;
  corporateName: string;
  /** Só dígitos. */
  document: string;
  city: string;
  state: string;
  /** URL de leitura assinada, de vida curta; ausente quando não há logo. */
  logoUrl?: string;
  status: CompanyStatus;
  managers: CompanyManagerRef[];
  actions: CompanyActions;
}

/**
 * Filtros de `GET /companies`. Sem `status`, a lista traz todas **menos** as
 * inativas — é a carteira em operação; `ALL` inclui as inativas.
 */
export interface CompanyListQuery {
  /**
   * Procura em tudo que foi cadastrado, menos observações — texto livre dá
   * resultado que ninguém entende. Sem acento nem maiúscula; CNPJ e CEP com ou
   * sem máscara.
   */
  q?: string;
  status?: CompanyStatus | 'ALL';
}

/** O que o lado cliente vê da própria empresa — o diálogo da sidebar. */
export interface CompanyProfile {
  view: 'CLIENT';
  id: string;
  tradeName: string;
  corporateName: string;
  document: string;
  stateRegistration?: string;
  contact: CompanyContact;
  address: CompanyAddress;
  status: CompanyStatus;
  /** URL de leitura assinada, com validade curta. */
  logoUrl?: string;
  /** A consultoria que presta o serviço. */
  accountName: string;
  /** Quem assina pela consultoria nesta empresa. */
  technicalResponsibles: TechnicalResponsible[];
}

/** Um Gestor com o que "usar dados do Gestor" precisa para preencher o contato. */
export interface CompanyManagerContact extends CompanyManagerRef {
  email: string;
  phone?: string;
  jobTitle?: string;
}

/** O que a consultoria vê — o diálogo com Editar, e o formulário de edição. */
export interface CompanyDetail extends Omit<CompanyProfile, 'view'> {
  view: 'CONSULTANCY';
  group?: CompanyGroupOption;
  externalCode?: string;
  notes?: string;
  managers: CompanyManagerContact[];
  actions: CompanyActions;
}

/** A resposta de `GET /companies/:companyId` — qual das duas, decide o servidor. */
export type CompanyView = CompanyProfile | CompanyDetail;

/**
 * Corpo de `POST /companies` e `PATCH /companies/:companyId`.
 *
 * O grupo vai **pelo nome**, e não pelo id: o servidor reaproveita o grupo que
 * já existe com aquele nome, ou cria. É isso que permite reusar um grupo que
 * está fora da carteira de quem cadastra **sem revelá-lo** — a tela nunca
 * precisou saber o id dele.
 */
export interface CompanyUpsertRequest {
  corporateName: string;
  tradeName: string;
  document: string;
  stateRegistration?: string;
  contact: CompanyContact;
  address: CompanyAddress;
  /** `null` ou vazio tira a empresa do grupo. */
  groupName?: string | null;
  externalCode?: string;
  notes?: string;
}
