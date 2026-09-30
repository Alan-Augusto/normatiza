import { ChangeDetectionStrategy, Component, computed, forwardRef, input, signal } from '@angular/core';
import { ControlValueAccessor, NG_VALUE_ACCESSOR } from '@angular/forms';

import { calculateHrn, requiresAction, type HrnFactor, type HrnScore, type HrnTable } from '@normatiza/shared';

import { HrnBadgeComponent } from '../hrn-badge/hrn-badge.component';

/** A escolha de cada fator, ou nulo enquanto não escolhido. */
export type HrnEscolha = Record<HrnFactor, number | null>;

export const HRN_VAZIO: HrnEscolha = { fe: null, pe: null, mpl: null, np: null };

const FATORES: { chave: HrnFactor; sigla: string; nome: string; pergunta: string }[] = [
  { chave: 'fe', sigla: 'FE', nome: 'Frequência de exposição', pergunta: 'Com que frequência alguém se expõe a este perigo?' },
  { chave: 'pe', sigla: 'PE', nome: 'Probabilidade de ocorrência', pergunta: 'Com as proteções que existem hoje, qual a chance de o acidente acontecer?' },
  { chave: 'mpl', sigla: 'MPL', nome: 'Máxima perda possível', pergunta: 'Se acontecer, qual o pior ferimento possível?' },
  { chave: 'np', sigla: 'NP', nome: 'Pessoas expostas', pergunta: 'Quantas pessoas ficam expostas ao mesmo tempo?' },
];

const decimal = new Intl.NumberFormat('pt-BR', { maximumFractionDigits: 2 });

let instâncias = 0;

/**
 * A calculadora do HRN (docs/produto/03 §5.2): quatro perguntas, a conta
 * montada na frente de quem responde e a régua das faixas nas cores do laudo.
 *
 * Didática de propósito: quem preenche é o técnico em campo, e o HRN é o que o
 * cliente vai ler no laudo. Ver FE × PE × MPL × NP = 120 e o ponto caindo em
 * "Muito Alto" ensina a conta; quatro selects só pediam quatro números.
 *
 * Por baixo são rádios nativos, um grupo por fator: as setas do teclado andam
 * entre as opções e o leitor de tela lê cada grupo com a pergunta dele. O valor
 * é a escolha dos quatro — o formulário decide se aceita pela metade (D12).
 */
@Component({
  selector: 'app-hrn-calculator',
  standalone: true,
  imports: [HrnBadgeComponent],
  changeDetection: ChangeDetectionStrategy.OnPush,
  providers: [{ provide: NG_VALUE_ACCESSOR, useExisting: forwardRef(() => HrnCalculatorComponent), multi: true }],
  templateUrl: './hrn-calculator.component.html',
  styleUrl: './hrn-calculator.component.css',
})
export class HrnCalculatorComponent implements ControlValueAccessor {
  readonly tabela = input.required<HrnTable>();

  protected readonly fatores = FATORES;
  protected readonly grupo = `hrn-${++instâncias}`;
  protected readonly escolha = signal<HrnEscolha>({ ...HRN_VAZIO });
  protected readonly desabilitado = signal(false);

  private aoMudar: (valor: HrnEscolha) => void = () => undefined;
  private aoTocar: () => void = () => undefined;

  protected readonly resultado = computed<HrnScore | null>(() => {
    const e = this.escolha();
    if (FATORES.some((f) => e[f.chave] === null)) return null;
    return calculateHrn({ fe: e.fe!, pe: e.pe!, mpl: e.mpl!, np: e.np! }, this.tabela());
  });

  protected readonly faltam = computed(() => FATORES.filter((f) => this.escolha()[f.chave] === null).length);

  /** A faixa em que o resultado caiu, com os limites dela escritos. */
  protected readonly faixa = computed(() => {
    const r = this.resultado();
    if (!r) return null;
    const faixas = this.tabela().levels;
    const indice = faixas.findIndex((f) => f.level === r.level);
    return { ...faixas[indice], indice, limites: limites(faixas[indice]) };
  });

  protected readonly faixas = computed(() => this.tabela().levels.map((f) => ({ ...f, limites: limites(f) })));

  protected readonly viraTarefa = computed(() => {
    const r = this.resultado();
    return r ? requiresAction(r.level) : null;
  });

  protected opcoes(fator: HrnFactor) {
    const lista = this.tabela().factors[fator];
    return lista.map((o, i) => ({ ...o, peso: decimal.format(o.weight), degrau: (i + 1) / lista.length }));
  }

  protected escolhido(fator: HrnFactor): number | null {
    return this.escolha()[fator];
  }

  protected pesoNaConta(fator: HrnFactor): string {
    const peso = this.escolha()[fator];
    return peso === null ? '?' : decimal.format(peso);
  }

  /** A ajuda de aplicação da opção escolhida — o legado a mostrava ao lado do PE. */
  protected ajuda(fator: HrnFactor): string | null {
    const peso = this.escolha()[fator];
    return this.tabela().factors[fator].find((o) => o.weight === peso)?.helpText ?? null;
  }

  protected escolher(fator: HrnFactor, peso: number): void {
    if (this.desabilitado()) return;
    this.escolha.update((e) => ({ ...e, [fator]: peso }));
    this.aoMudar(this.escolha());
    this.aoTocar();
  }

  protected limpar(): void {
    this.escolha.set({ ...HRN_VAZIO });
    this.aoMudar(this.escolha());
    this.aoTocar();
  }

  writeValue(valor: HrnEscolha | null | undefined): void {
    this.escolha.set({ ...HRN_VAZIO, ...(valor ?? {}) });
  }

  registerOnChange(fn: (valor: HrnEscolha) => void): void {
    this.aoMudar = fn;
  }

  registerOnTouched(fn: () => void): void {
    this.aoTocar = fn;
  }

  setDisabledState(desabilitado: boolean): void {
    this.desabilitado.set(desabilitado);
  }
}

/** "acima de 100 até 500", "até 1", "acima de 1000" — como 04 §7 escreve as faixas. */
function limites(f: { minExclusive: number | null; maxInclusive: number | null }): string {
  if (f.minExclusive === null) return `até ${decimal.format(f.maxInclusive!)}`;
  if (f.maxInclusive === null) return `acima de ${decimal.format(f.minExclusive)}`;
  return `acima de ${decimal.format(f.minExclusive)} até ${decimal.format(f.maxInclusive)}`;
}
