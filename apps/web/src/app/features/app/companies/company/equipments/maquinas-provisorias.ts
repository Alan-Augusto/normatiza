/**
 * Máquinas inventadas — **descartável**.
 *
 * `Equipment` não existe: nem modelo no Prisma, nem tabela, nem endpoint. Estas
 * três linhas existem para que o Contexto 3 seja alcançável e a navegação possa
 * ser exercida antes do cadastro de equipamentos.
 *
 * Ficam num arquivo próprio, e não dentro da tela, porque o layout do Contexto 3
 * precisa da mesma lista para nomear a máquina no cabeçalho de contexto — e uma
 * segunda cópia inventaria nomes diferentes para o mesmo `id`. Quando o cadastro
 * chegar, este arquivo é apagado inteiro.
 */
export interface MaquinaProvisoria {
  id: string;
  nome: string;
  setor: string;
}

export const MAQUINAS_PROVISORIAS: readonly MaquinaProvisoria[] = [
  { id: 'eq-prensa', nome: 'Prensa excêntrica 60t', setor: 'Estamparia' },
  { id: 'eq-injetora', nome: 'Injetora de plástico', setor: 'Injeção' },
  { id: 'eq-esteira', nome: 'Esteira transportadora', setor: 'Expedição' },
];

export function nomeDaMaquina(equipmentId: string): string | null {
  return MAQUINAS_PROVISORIAS.find((maquina) => maquina.id === equipmentId)?.nome ?? null;
}
