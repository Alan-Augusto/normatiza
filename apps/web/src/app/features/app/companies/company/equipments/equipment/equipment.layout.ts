import { Component, DestroyRef, effect, inject } from '@angular/core';
import { toSignal } from '@angular/core/rxjs-interop';
import { ActivatedRoute, RouterLink, RouterOutlet } from '@angular/router';
import { map } from 'rxjs/operators';

import { empresaDaRota } from '@core/routing/empresa-da-rota';
import { ROTAS } from '@core/routing/rotas';
import { ActiveContextService } from '@core/services/active-context.service';
import { InventoryService } from '@core/services/inventory.service';

import { EquipmentContext } from './equipment-context';

/**
 * Contexto 3 — Equipamento.
 *
 * Carrega a máquina que a URL nomeia pelo código (`eq-0042`) e a publica duas
 * vezes: no `ActiveContextService`, para o cabeçalho mostrar em qual máquina a
 * pessoa está, e no `EquipmentContext`, para as telas de dentro.
 */
@Component({
  selector: 'app-equipment-layout',
  standalone: true,
  imports: [RouterOutlet, RouterLink],
  providers: [EquipmentContext],
  templateUrl: './equipment.layout.html',
  styleUrl: './equipment.layout.css',
})
export class EquipmentLayoutComponent {
  private readonly route = inject(ActivatedRoute);
  private readonly activeContext = inject(ActiveContextService);
  private readonly inventory = inject(InventoryService);
  protected readonly contexto = inject(EquipmentContext);

  private readonly empresa = empresaDaRota();
  private readonly code = toSignal(this.route.paramMap.pipe(map((p) => p.get('equipmentCode'))), {
    initialValue: this.route.snapshot?.paramMap.get('equipmentCode') ?? null,
  });

  protected readonly voltar = () => ROTAS.empresa(this.empresa()?.slug ?? '').equipamentos;

  constructor() {
    effect(() => {
      const empresa = this.empresa();
      const code = this.code();
      if (!empresa || !code) return;
      this.carregar(empresa.id, code);
    });

    // Voltar para a lista de equipamentos apaga a máquina, e só ela: a empresa
    // continua em contexto, porque a pessoa continua dentro dela.
    inject(DestroyRef).onDestroy(() => this.activeContext.setEquipment(null));
  }

  private carregar(companyId: string, code: string): void {
    this.contexto.carregando.set(true);
    this.contexto.inexistente.set(false);

    this.inventory.getEquipment(companyId, code).subscribe({
      next: (equipamento) => {
        this.contexto.atual.set(equipamento);
        this.contexto.carregando.set(false);
        this.activeContext.setEquipment({ id: equipamento.code, name: equipamento.name });
      },
      error: () => {
        // Não existe, ou não existe para quem olha — a API não distingue, e a
        // tela também não: um nome inventado seria pior que o aviso.
        this.contexto.atual.set(null);
        this.contexto.carregando.set(false);
        this.contexto.inexistente.set(true);
        this.activeContext.setEquipment(null);
      },
    });
  }
}
