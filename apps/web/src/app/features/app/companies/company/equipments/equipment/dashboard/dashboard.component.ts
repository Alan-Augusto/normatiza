import { DatePipe, DecimalPipe } from '@angular/common';
import { Component, computed, inject } from '@angular/core';
import { RouterLink } from '@angular/router';
import { NgIconComponent, provideIcons } from '@ng-icons/core';
import { lucideBox, lucidePencil } from '@ng-icons/lucide';
import { ButtonDirective, ButtonIcon, ButtonLabel } from 'primeng/button';

import { EQUIPMENT_COMPLIANCE_LABEL, EQUIPMENT_STATUS_LABEL } from '@normatiza/shared';

import { empresaDaRota } from '@core/routing/empresa-da-rota';
import { ROTAS } from '@core/routing/rotas';

import { EquipmentContext } from '../equipment-context';
import { linhasDaFicha } from '../ficha-do-ativo';

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

  readonly ficha = computed(() => linhasDaFicha(this.equipamento()?.sheet));

  rotuloDaConformidade(): string {
    const e = this.equipamento();
    return e ? EQUIPMENT_COMPLIANCE_LABEL[e.complianceStatus] : '';
  }

  rotuloDoStatus(): string {
    const e = this.equipamento();
    return e ? EQUIPMENT_STATUS_LABEL[e.status] : '';
  }
}
