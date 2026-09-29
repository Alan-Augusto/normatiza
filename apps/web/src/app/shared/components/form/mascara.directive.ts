import { Directive, ElementRef, forwardRef, inject, input } from '@angular/core';
import { ControlValueAccessor, NG_VALUE_ACCESSOR } from '@angular/forms';

export type TipoDeMascara = 'cnpj' | 'cpf' | 'cep' | 'telefone';

/** `9` é um dígito; o resto é pontuação que a máscara põe sozinha. */
const PADRÕES: Record<Exclude<TipoDeMascara, 'telefone'>, string> = {
  cnpj: '99.999.999/9999-99',
  cpf: '999.999.999-99',
  cep: '99999-999',
};

/** Fixo tem 10 dígitos, celular 11: o padrão acompanha o que foi digitado. */
function padrãoDo(tipo: TipoDeMascara, dígitos: string): string {
  if (tipo !== 'telefone') return PADRÕES[tipo];
  return dígitos.length > 10 ? '(99) 99999-9999' : '(99) 9999-9999';
}

function tamanho(tipo: TipoDeMascara): number {
  return tipo === 'telefone' ? 11 : PADRÕES[tipo].replace(/[^9]/g, '').length;
}

/** Aplica o padrão até onde houver dígito: "112" vira "11.2", não "11.2__.___". */
export function aplicarMascara(tipo: TipoDeMascara, bruto: string): string {
  const dígitos = bruto.replace(/\D/g, '').slice(0, tamanho(tipo));
  const padrão = padrãoDo(tipo, dígitos);
  let saída = '';
  let i = 0;
  for (const símbolo of padrão) {
    if (i >= dígitos.length) break;
    if (símbolo === '9') saída += dígitos[i++];
    else saída += símbolo;
  }
  return saída;
}

/**
 * Máscara enquanto se digita, para os documentos e contatos do sistema
 * (docs/web/design_system.md §9).
 *
 * A pessoa **vê** `11.222.333/0001-81`; o formulário **guarda** `11222333000181`.
 * Validador, busca e API recebem só dígitos, e a máscara é apresentação — como
 * o banco já trata o CNPJ.
 *
 * Diretiva, e não componente: o campo continua sendo o `pInputText` de sempre,
 * com o mesmo visual e os mesmos atributos, e a máscara só cuida do texto.
 */
@Directive({
  selector: 'input[appMascara]',
  standalone: true,
  providers: [{ provide: NG_VALUE_ACCESSOR, useExisting: forwardRef(() => MascaraDirective), multi: true }],
  host: {
    inputmode: 'numeric',
    autocomplete: 'off',
    '(input)': 'aoDigitar()',
    '(blur)': 'aoTocar()',
  },
})
export class MascaraDirective implements ControlValueAccessor {
  readonly appMascara = input.required<TipoDeMascara>();

  private readonly campo = inject<ElementRef<HTMLInputElement>>(ElementRef).nativeElement;
  private aoMudar: (valor: string) => void = () => undefined;
  protected aoTocar: () => void = () => undefined;

  aoDigitar(): void {
    const antes = this.campo.value;
    const cursor = this.campo.selectionStart ?? antes.length;
    // Quantos dígitos havia antes do cursor: é essa posição que se preserva,
    // e não o índice do caractere — a pontuação muda de lugar ao formatar.
    const dígitosAntes = antes.slice(0, cursor).replace(/\D/g, '').length;

    const formatado = aplicarMascara(this.appMascara(), antes);
    this.campo.value = formatado;
    this.posicionar(formatado, dígitosAntes);
    this.aoMudar(formatado.replace(/\D/g, ''));
  }

  writeValue(valor: string | null | undefined): void {
    this.campo.value = aplicarMascara(this.appMascara(), valor ?? '');
  }

  registerOnChange(fn: (valor: string) => void): void {
    this.aoMudar = fn;
  }

  registerOnTouched(fn: () => void): void {
    this.aoTocar = fn;
  }

  setDisabledState(desabilitado: boolean): void {
    this.campo.disabled = desabilitado;
  }

  private posicionar(formatado: string, dígitos: number): void {
    if (document.activeElement !== this.campo) return;
    let posição = 0;
    let vistos = 0;
    while (posição < formatado.length && vistos < dígitos) {
      if (/\d/.test(formatado[posição])) vistos++;
      posição++;
    }
    this.campo.setSelectionRange(posição, posição);
  }
}
