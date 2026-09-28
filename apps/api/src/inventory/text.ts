/** Texto opcional de formulário: aparado, e vazio vira ausência. */
export function opcional(valor: string | null | undefined): string | null {
  const aparado = valor?.trim() ?? '';
  return aparado === '' ? null : aparado;
}
