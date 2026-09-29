import { Directive, input, signal } from '@angular/core';
import { ControlValueAccessor } from '@angular/forms';

/**
 * A base do número e do dinheiro: o texto que a pessoa digita, à brasileira, de
 * um lado; o valor que o formulário guarda, do outro.
 *
 * Enquanto se digita, só entram dígitos e uma vírgula — letra nem chega a
 * aparecer, e por isso não existe erro de "isto não é número". Ao sair do
 * campo, o número se formata com ponto de milhar ("4.200"). Vazio é `null`,
 * nunca zero: zero seria afirmar uma medida que ninguém fez.
 */
@Directive()
export abstract class CampoNumerico implements ControlValueAccessor {
  readonly inputId = input.required<string>();
  /** Vai no `<input>`, para teste e para quem precisar achá-lo. */
  readonly testid = input<string>();
  readonly placeholder = input('');
  /** Aria do campo: quem descreve o erro ou a ajuda dele (`app-campo`). */
  readonly descritoPor = input<string | null>(null);

  protected readonly texto = signal('');
  protected readonly desabilitado = signal(false);

  private aoMudar: (valor: number | null) => void = () => undefined;
  protected aoTocar: () => void = () => undefined;

  /** Casas decimais aceitas. Zero: só inteiro, e a vírgula nem entra. */
  protected abstract casas(): number;
  /** Casas sempre mostradas ao sair do campo — dinheiro tem duas, medida não. */
  protected abstract casasFixas(): number;
  protected abstract agrupa(): boolean;
  /** O número lido na tela vira o valor do formulário (reais → centavos, na moeda). */
  protected abstract paraModelo(número: number): number;
  protected abstract doModelo(valor: number): number;

  aoDigitar(evento: Event): void {
    const campo = evento.target as HTMLInputElement;
    const limpo = this.limpar(campo.value);
    // Direto no elemento: se o texto limpo for igual ao anterior (a letra que se
    // tentou digitar), o sinal não muda e a letra ficaria na tela.
    campo.value = limpo;
    this.texto.set(limpo);
    this.aoMudar(this.ler(limpo));
  }

  aoSair(): void {
    const número = this.lerDaTela(this.texto());
    this.texto.set(número === null ? '' : this.formatar(número));
    this.aoTocar();
  }

  writeValue(valor: number | null | undefined): void {
    this.texto.set(valor === null || valor === undefined ? '' : this.formatar(this.doModelo(valor)));
  }

  registerOnChange(fn: (valor: number | null) => void): void {
    this.aoMudar = fn;
  }

  registerOnTouched(fn: () => void): void {
    this.aoTocar = fn;
  }

  setDisabledState(desabilitado: boolean): void {
    this.desabilitado.set(desabilitado);
  }

  /** Dígitos e, se houver casas, uma vírgula com no máximo essas casas. O ponto é milhar e sai. */
  private limpar(bruto: string): string {
    const casas = this.casas();
    const semMilhar = bruto.replace(/\./g, '');
    if (casas === 0) return semMilhar.replace(/\D/g, '');

    const [inteira, ...resto] = semMilhar.replace(/[^\d,]/g, '').split(',');
    if (resto.length === 0) return inteira;
    return `${inteira},${resto.join('').slice(0, casas)}`;
  }

  /**
   * O número como está na tela — em reais, na moeda. O texto pode vir
   * formatado ("4.200", depois de sair do campo), e o ponto ali é milhar.
   */
  private lerDaTela(texto: string): number | null {
    const semMilhar = texto.replace(/\./g, '');
    if (!semMilhar || semMilhar === ',') return null;
    return Number(semMilhar.replace(',', '.'));
  }

  /** O valor do formulário — em centavos, na moeda. */
  private ler(texto: string): number | null {
    const número = this.lerDaTela(texto);
    return número === null ? null : this.paraModelo(número);
  }

  private formatar(número: number): string {
    return new Intl.NumberFormat('pt-BR', {
      minimumFractionDigits: this.casasFixas(),
      maximumFractionDigits: this.casas(),
      useGrouping: this.agrupa(),
    }).format(número);
  }
}
