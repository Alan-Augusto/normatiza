import { Component, inject, effect } from '@angular/core';
import { RouterOutlet, ActivatedRoute } from '@angular/router';
import { toSignal } from '@angular/core/rxjs-interop';
import { map } from 'rxjs/operators';
import { ActiveContextService } from '@core/services/active-context.service';

/**
 * Contexto 3 — Equipamento.
 *
 * Publica o equipamento em contexto para o layout exibir junto da empresa,
 * de modo que o usuário sempre saiba em qual máquina está atuando.
 */
@Component({
  selector: 'app-equipment-layout',
  standalone: true,
  imports: [RouterOutlet],
  templateUrl: './equipment.layout.html',
  styleUrl: './equipment.layout.css'
})
export class EquipmentLayoutComponent {
  private readonly route = inject(ActivatedRoute);
  private readonly activeContext = inject(ActiveContextService);

  private readonly equipmentId = toSignal(
    this.route.paramMap.pipe(map(params => params.get('equipmentId'))),
    { initialValue: null }
  );

  constructor() {
    effect(() => {
      const id = this.equipmentId();
      // TODO: substituir pelo nome real quando a API de equipamentos existir.
      this.activeContext.setEquipment(id ? { id, name: `Equipamento ${id}` } : null);
    });
  }
}
