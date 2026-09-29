/**
 * O HRN — Hazard Rating Number (docs/produto/04 §7).
 *
 * `HRN = FE × PE × MPL × NP`, com os pesos e as faixas **idênticos ao legado**:
 * laudo emitido há anos precisa dar o mesmo número hoje. Os mesmos valores vão
 * semeados no banco (`hrn_table_versions`), e a análise guarda qual versão usou.
 */

export type RiskLevel =
  | 'ACCEPTABLE'
  | 'VERY_LOW'
  | 'LOW'
  | 'SIGNIFICANT'
  | 'HIGH'
  | 'VERY_HIGH'
  | 'EXTREME'
  | 'UNACCEPTABLE';

export type HrnFactor = 'fe' | 'pe' | 'mpl' | 'np';

export interface HrnFactorOption {
  weight: number;
  label: string;
  /** A ajuda de aplicação técnica que o legado mostrava ao lado da opção. */
  helpText?: string;
}

/** Uma faixa: acima de `minExclusive` até `maxInclusive`. Nulo = sem limite daquele lado. */
export interface HrnLevelBand {
  level: RiskLevel;
  label: string;
  minExclusive: number | null;
  maxInclusive: number | null;
}

export interface HrnTable {
  id: string;
  label: string;
  /** ISO 8601. */
  effectiveFrom: string;
  factors: Record<HrnFactor, HrnFactorOption[]>;
  levels: HrnLevelBand[];
}

export type HrnFactors = Record<HrnFactor, number>;

export interface HrnScore extends HrnFactors {
  result: number;
  level: RiskLevel;
}

/** A versão inicial, copiada do legado. Nunca se edita: peso novo é versão nova. */
export const HRN_TABLE_LEGACY: HrnTable = {
  id: 'hrn-legado-v1',
  label: 'Tabela do sistema anterior',
  // A data de início do legado não importa: toda análise migrada usa esta versão.
  effectiveFrom: '2000-01-01T00:00:00.000Z',
  factors: {
    fe: [
      { weight: 0.5, label: 'Anualmente' },
      { weight: 1, label: 'Mensalmente' },
      { weight: 1.5, label: 'Semanalmente' },
      { weight: 2.5, label: 'Diariamente' },
      { weight: 4, label: 'Em termos de hora' },
      { weight: 5, label: 'Constantemente' },
    ],
    pe: [
      { weight: 0.03, label: 'Quase impossível', helpText: 'Ponto totalmente protegido. Sem chance de falha física normal.' },
      { weight: 1, label: 'Altamente improvável', helpText: 'Ponto protegido, sem sensores, mas posicionado fora da área operacional ativa.' },
      { weight: 1.5, label: 'Improvável', helpText: 'Situação improvável, mas concebível (ex: barreira mecânica sem sensor).' },
      { weight: 2, label: 'Possível', helpText: 'Situação possível, mas não usual (ex: proteção móvel NR-12 sem chave de segurança).' },
      { weight: 5, label: 'Alguma chance', helpText: 'O perigo pode ser acessado de forma voluntária (aberturas médias/grandes).' },
      { weight: 8, label: 'Provável', helpText: 'O operador realiza atividades muito próximo ao ponto, sem barreira física.' },
      { weight: 10, label: 'Muito provável', helpText: 'Operador interage diretamente com a zona ou sistema de acionamento manual aberto.' },
      { weight: 15, label: 'Certo', helpText: 'Operador trabalha em contato físico direto contínuo com a parte móvel/perigosa.' },
    ],
    mpl: [
      { weight: 0.1, label: 'Arranhão / contusão leve' },
      { weight: 0.5, label: 'Dilaceração / doenças moderadas' },
      { weight: 2, label: 'Fratura / enfermidade leve' },
      { weight: 4, label: 'Fratura / enfermidade grave' },
      { weight: 6, label: 'Perda de um membro / olho' },
      { weight: 10, label: 'Perda de dois membros / olhos' },
      { weight: 15, label: 'Fatalidade' },
    ],
    np: [
      { weight: 1, label: '1-2 pessoas' },
      { weight: 2, label: '3-7 pessoas' },
      { weight: 4, label: '8-15 pessoas' },
      { weight: 8, label: '16-50 pessoas' },
      { weight: 12, label: 'Mais que 50 pessoas' },
    ],
  },
  // A regra do laudo do legado (`> 1 e ≤ 5`…), sem buraco entre as faixas.
  levels: [
    { level: 'ACCEPTABLE', label: 'Risco Aceitável', minExclusive: null, maxInclusive: 1 },
    { level: 'VERY_LOW', label: 'Risco Muito Baixo', minExclusive: 1, maxInclusive: 5 },
    { level: 'LOW', label: 'Risco Baixo', minExclusive: 5, maxInclusive: 10 },
    { level: 'SIGNIFICANT', label: 'Risco Significante', minExclusive: 10, maxInclusive: 50 },
    { level: 'HIGH', label: 'Risco Alto', minExclusive: 50, maxInclusive: 100 },
    { level: 'VERY_HIGH', label: 'Risco Muito Alto', minExclusive: 100, maxInclusive: 500 },
    { level: 'EXTREME', label: 'Risco Extremo', minExclusive: 500, maxInclusive: 1000 },
    { level: 'UNACCEPTABLE', label: 'Risco Inaceitável', minExclusive: 1000, maxInclusive: null },
  ],
};

const FATORES: HrnFactor[] = ['fe', 'pe', 'mpl', 'np'];

/**
 * Centésimos inteiros. Em ponto flutuante, `2.5 × 0.03 × …` pode dar
 * `5.000000000001` e pular de faixa; em inteiros a conta é exata. Todo peso da
 * tabela tem no máximo duas casas.
 */
const centesimos = (valor: number): number => Math.round(valor * 100);
/** O produto de quatro pesos em centésimos está na escala 100⁴. */
const ESCALA_DO_PRODUTO = 100 ** 4;

/** O peso existe na tabela para aquele fator? A API recusa o que não existe. */
export function isHrnWeight(fator: HrnFactor, peso: number, tabela: HrnTable = HRN_TABLE_LEGACY): boolean {
  return tabela.factors[fator].some((opção) => centesimos(opção.weight) === centesimos(peso));
}

export function hrnLevel(resultado: number, tabela: HrnTable = HRN_TABLE_LEGACY): HrnLevelBand {
  const r = Math.round(resultado * ESCALA_DO_PRODUTO);
  const faixa = tabela.levels.find(
    (f) =>
      (f.minExclusive === null || r > Math.round(f.minExclusive * ESCALA_DO_PRODUTO)) &&
      (f.maxInclusive === null || r <= Math.round(f.maxInclusive * ESCALA_DO_PRODUTO)),
  );
  // As faixas cobrem de menos infinito a infinito; faltar uma é tabela quebrada.
  if (!faixa) throw new RangeError(`Nenhuma faixa de HRN cobre ${resultado}`);
  return faixa;
}

/** Calcula o HRN. Peso fora da tabela é erro de quem chamou, e não um risco. */
export function calculateHrn(fatores: HrnFactors, tabela: HrnTable = HRN_TABLE_LEGACY): HrnScore {
  for (const fator of FATORES) {
    if (!isHrnWeight(fator, fatores[fator], tabela)) {
      throw new RangeError(`Peso ${fatores[fator]} não existe na tabela para ${fator.toUpperCase()}`);
    }
  }
  const produto = FATORES.reduce((acc, fator) => acc * centesimos(fatores[fator]), 1);
  const result = produto / ESCALA_DO_PRODUTO;
  return { ...fatores, result, level: hrnLevel(result, tabela).level };
}

/** Só o que está acima do aceitável entra no plano de ação (docs/produto/02 §4). */
export function requiresAction(level: RiskLevel): boolean {
  return level !== 'ACCEPTABLE';
}
