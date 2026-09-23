/**
 * CNPJ, CEP e o texto de busca — regras puras que valem igual no servidor, no
 * painel e no app de campo.
 *
 * O CNPJ é **gravado só com dígitos** e formatado na apresentação. Se a máscara
 * entrasse no banco, a unicidade por conta dependeria de como alguém digitou:
 * `22.222.222/0001-22` e `22222222000122` seriam duas empresas.
 */

export function onlyDigits(value: string): string {
  return value.replace(/\D/g, '');
}

/** Dígito verificador do CNPJ — o algoritmo da Receita, módulo 11. */
export function isValidCnpj(value: string): boolean {
  const cnpj = onlyDigits(value);
  if (cnpj.length !== 14) return false;

  // "00000000000000", "11111111111111"… passam no módulo 11 e não são CNPJ.
  if (/^(\d)\1{13}$/.test(cnpj)) return false;

  const digito = (base: string): number => {
    let peso = base.length - 7;
    let soma = 0;
    for (const n of base) {
      soma += Number(n) * peso;
      peso = peso === 2 ? 9 : peso - 1;
    }
    const resto = soma % 11;
    return resto < 2 ? 0 : 11 - resto;
  };

  const primeiro = digito(cnpj.slice(0, 12));
  const segundo = digito(cnpj.slice(0, 12) + primeiro);
  return cnpj.endsWith(`${primeiro}${segundo}`);
}

export function formatCnpj(value: string): string {
  const d = onlyDigits(value);
  if (d.length !== 14) return value;
  return `${d.slice(0, 2)}.${d.slice(2, 5)}.${d.slice(5, 8)}/${d.slice(8, 12)}-${d.slice(12)}`;
}

export function isValidCep(value: string): boolean {
  return onlyDigits(value).length === 8;
}

export function formatCep(value: string): string {
  const d = onlyDigits(value);
  if (d.length !== 8) return value;
  return `${d.slice(0, 5)}-${d.slice(5)}`;
}

/** As 27 unidades federativas, na ordem em que aparecem no seletor. */
export const BRAZIL_STATES = [
  'AC', 'AL', 'AM', 'AP', 'BA', 'CE', 'DF', 'ES', 'GO', 'MA', 'MG', 'MS', 'MT', 'PA',
  'PB', 'PE', 'PI', 'PR', 'RJ', 'RN', 'RO', 'RR', 'RS', 'SC', 'SE', 'SP', 'TO',
] as const;

export type BrazilState = (typeof BRAZIL_STATES)[number];

/**
 * O texto como a busca o compara: sem acento, sem maiúscula, sem espaço
 * sobrando. "São Paulo", "sao paulo" e "SAO  PAULO" são a mesma coisa.
 *
 * É também a chave de unicidade do grupo empresarial — "Grupo BRF" e
 * "grupo brf" são o mesmo grupo.
 */
export function normalizeForSearch(value: string): string {
  return value
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .toLowerCase()
    .replace(/\s+/g, ' ')
    .trim();
}
