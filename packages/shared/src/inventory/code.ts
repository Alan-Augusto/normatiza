/**
 * O código do equipamento: `EQ-0001`, sequencial por empresa, imutável e nunca
 * reaproveitado (docs/produto/03 §4.2). É a chave da URL e da API.
 */

const PREFIXO = 'EQ-';

/** O número vira código. Quatro dígitos cobrem a planta comum; passando disso, cresce. */
export function formatEquipmentCode(numero: number): string {
  return `${PREFIXO}${String(numero).padStart(4, '0')}`;
}

/**
 * O código como vem da URL (`eq-0042`) ou digitado, na forma canônica
 * (`EQ-0042`). `null` quando não é código de equipamento.
 */
export function parseEquipmentCode(texto: string): string | null {
  const achado = /^eq-(\d{4,})$/i.exec(texto.trim());
  return achado ? `${PREFIXO}${achado[1]}` : null;
}

/** O código como vai na URL: minúsculas, como o resto do endereço. */
export function equipmentCodeForUrl(code: string): string {
  return code.toLowerCase();
}
