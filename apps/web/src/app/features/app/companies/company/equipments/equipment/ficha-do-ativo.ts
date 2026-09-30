import { ENERGY_SOURCE_LABEL, formatCnpj, type EquipmentSheet } from '@normatiza/shared';

export interface LinhaDaFicha {
  chave: string;
  rotulo: string;
  valor: string;
  /** Texto longo ocupa a linha inteira. */
  longo?: boolean;
}

/**
 * A ficha do ativo em linhas de leitura — o painel do equipamento e a etapa 1
 * da análise mostram a mesma. Só o que foi preenchido: uma ficha vazia vira um
 * aviso, não dezesseis "—" em sequência.
 */
export function linhasDaFicha(f: EquipmentSheet | undefined): LinhaDaFicha[] {
  if (!f) return [];
  const linhas: { chave: string; rotulo: string; valor: string | undefined; longo?: boolean }[] = [
    { chave: 'utilizacao', rotulo: 'Utilização', valor: f.purpose },
    { chave: 'capacidade', rotulo: 'Capacidade produtiva', valor: f.productiveCapacity },
    { chave: 'potencia', rotulo: 'Potência', valor: comUnidade(f.powerKw, 'kW') },
    { chave: 'postos', rotulo: 'Postos de comando', valor: f.controlStations?.toString() },
    { chave: 'operadores', rotulo: 'Operadores expostos', valor: f.exposedOperators?.toString() },
    {
      chave: 'energia',
      rotulo: 'Fontes de energia',
      valor: f.energySources.length ? f.energySources.map((e) => ENERGY_SOURCE_LABEL[e]).join(' · ') : undefined,
    },
    { chave: 'altura', rotulo: 'Altura', valor: comUnidade(f.dimensions.heightMm, 'mm') },
    { chave: 'largura', rotulo: 'Largura', valor: comUnidade(f.dimensions.widthMm, 'mm') },
    { chave: 'profundidade', rotulo: 'Profundidade', valor: comUnidade(f.dimensions.depthMm, 'mm') },
    { chave: 'peso', rotulo: 'Peso', valor: comUnidade(f.dimensions.weightKg, 'kg') },
    { chave: 'fabricante-cnpj', rotulo: 'CNPJ do fabricante', valor: f.manufacturer.document ? formatCnpj(f.manufacturer.document) : undefined },
    { chave: 'fabricante-crea', rotulo: 'CREA do fabricante', valor: f.manufacturer.registry },
    { chave: 'fabricante-endereco', rotulo: 'Endereço do fabricante', valor: enderecoDo(f) },
    { chave: 'processo', rotulo: 'Descrição do processo', valor: f.processDescription, longo: true },
    { chave: 'intervencoes', rotulo: 'Intervenções comuns do operador', valor: f.commonInterventions, longo: true },
    { chave: 'outras', rotulo: 'Outras informações', valor: f.otherInfo, longo: true },
  ];
  return linhas.filter((l): l is LinhaDaFicha => !!l.valor);
}

/** 7.5 → "7,5 kW": como se lê aqui. */
function comUnidade(n: number | undefined, unidade: string): string | undefined {
  return n === undefined ? undefined : `${String(n).replace('.', ',')} ${unidade}`;
}

function enderecoDo(f: EquipmentSheet): string | undefined {
  const { address, city, zipCode } = f.manufacturer;
  const cep = zipCode ? `${zipCode.slice(0, 5)}-${zipCode.slice(5)}` : undefined;
  const partes = [address, city, cep].filter(Boolean);
  return partes.length ? partes.join(' · ') : undefined;
}
