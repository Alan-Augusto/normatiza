import { DatePipe, DecimalPipe } from '@angular/common';
import { Component, computed, inject } from '@angular/core';
import { RouterLink } from '@angular/router';
import { NgIconComponent, provideIcons } from '@ng-icons/core';
import { lucideBox, lucidePencil } from '@ng-icons/lucide';
import { ButtonDirective, ButtonIcon, ButtonLabel } from 'primeng/button';

import {
  ENERGY_SOURCE_LABEL,
  EQUIPMENT_COMPLIANCE_LABEL,
  EQUIPMENT_STATUS_LABEL,
  formatCnpj,
  type EquipmentSheet,
} from '@normatiza/shared';

import { empresaDaRota } from '@core/routing/empresa-da-rota';
import { ROTAS } from '@core/routing/rotas';

import { EquipmentContext } from '../equipment-context';

/**
 * Radiografia da máquina — Contexto 3 (docs/produto/03 §5.1).
 *
 * A identificação vem do cadastro e está completa desde o primeiro dia. Os
 * indicadores de risco e adequação são das análises: até a primeira, dizem
 * "—", pela mesma regra de todas as listas — zero ponto em aberto é verdade,
 * "pior HRN 0" seria invenção.
 */
@Component({
  selector: 'app-equipment-dashboard',
  standalone: true,
  imports: [DatePipe, DecimalPipe, RouterLink, NgIconComponent, ButtonDirective, ButtonIcon, ButtonLabel],
  providers: [provideIcons({ lucideBox, lucidePencil })],
  templateUrl: './dashboard.component.html',
  styleUrl: './dashboard.component.css',
})
export class EquipmentDashboardComponent {
  protected readonly contexto = inject(EquipmentContext);
  private readonly empresa = empresaDaRota();

  readonly equipamento = this.contexto.atual;

  readonly rotaDeEdicao = computed(() => {
    const e = this.equipamento();
    return e ? ROTAS.empresa(this.empresa()?.slug ?? '').equipamento(e.code).editar : '';
  });

  readonly identidade = computed(() => {
    const e = this.equipamento();
    if (!e) return [];
    return [
      { chave: 'tipo', rotulo: 'Tipo de máquina', valor: e.machineType?.name },
      { chave: 'modelo', rotulo: 'Modelo', valor: e.model },
      { chave: 'fabricante', rotulo: 'Fabricante', valor: e.manufacturerName },
      { chave: 'serie', rotulo: 'Número de série', valor: e.serialNumber },
      { chave: 'ano', rotulo: 'Ano de fabricação', valor: e.manufactureYear?.toString() },
      { chave: 'tag', rotulo: 'TAG', valor: e.tag },
      { chave: 'patrimonio', rotulo: 'Patrimônio', valor: e.patrimonyCode },
      { chave: 'setor', rotulo: 'Setor', valor: e.sector?.name },
    ];
  });

  /**
   * A ficha do ativo, em linhas de leitura. Só o que foi preenchido: uma ficha
   * vazia vira um aviso, não oito "—" em sequência.
   */
  readonly ficha = computed(() => {
    const f = this.equipamento()?.sheet;
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
    return linhas.filter((l) => l.valor);
  });

  rotuloDaConformidade(): string {
    const e = this.equipamento();
    return e ? EQUIPMENT_COMPLIANCE_LABEL[e.complianceStatus] : '';
  }

  rotuloDoStatus(): string {
    const e = this.equipamento();
    return e ? EQUIPMENT_STATUS_LABEL[e.status] : '';
  }
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
