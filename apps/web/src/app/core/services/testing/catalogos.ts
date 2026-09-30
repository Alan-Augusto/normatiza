import { HRN_TABLE_LEGACY, type AnalysisCatalogsDto } from '@normatiza/shared';

/** Um recorte dos catálogos da análise, com a tabela HRN de verdade. */
export function catalogosDeTeste(): AnalysisCatalogsDto {
  return {
    version: 'v-teste',
    standardSections: [
      {
        id: 'sec-12-4',
        norm: 'NR-12',
        name: '12.4 Dispositivos de partida, acionamento e parada',
        standards: [{ id: 'std-pap', itemCode: '12.4.1', text: 'Conforme item 12.4.1, os dispositivos de partida devem…' }],
      },
      {
        id: 'sec-12-6',
        norm: 'NR-12',
        name: '12.6 Dispositivos de parada de emergência',
        standards: [{ id: 'std-pe', itemCode: '12.6.1', text: 'Conforme item 12.6.1, as máquinas devem ser equipadas com dispositivos de parada de emergência…' }],
      },
      {
        id: 'sec-12-5',
        norm: 'NR-12',
        name: '12.5 Sistemas de segurança',
        standards: [
          { id: 'std-1', itemCode: '12.5.1', text: 'Conforme item 12.5.1, as zonas de perigo devem possuir sistemas de segurança.' },
          { id: 'std-2', itemCode: '12.5.2', text: 'Conforme item 12.5.2, os sistemas de segurança devem ser selecionados…' },
        ],
      },
    ],
    hazardTypes: [
      {
        id: 'ht-mec',
        name: 'Perigos Mecânicos',
        origins: [{ id: 'ho-moveis', name: 'Partes móveis' }],
        consequences: [{ id: 'hc-esmagamento', name: 'Esmagamento' }],
      },
    ],
    protectionTypes: [{ id: 'pt-fixa', name: 'Proteção Fixa', protections: [{ id: 'pr-grade', name: 'Grade soldada' }] }],
    hrnTable: HRN_TABLE_LEGACY,
  };
}
