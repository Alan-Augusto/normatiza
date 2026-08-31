import { Component, DestroyRef, inject, effect } from '@angular/core';
import { RouterOutlet, ActivatedRoute } from '@angular/router';
import { toSignal } from '@angular/core/rxjs-interop';
import { map } from 'rxjs/operators';
import { ActiveContextService } from '@core/services/active-context.service';

import { nomeDaMaquina } from '../maquinas-provisorias';

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
  styleUrl: './equipment.layout.css',
})
export class EquipmentLayoutComponent {
  private readonly route = inject(ActivatedRoute);
  private readonly activeContext = inject(ActiveContextService);

  private readonly equipmentId = toSignal(
    this.route.paramMap.pipe(map((params) => params.get('equipmentId'))),
    { initialValue: null },
  );

  constructor() {
    effect(() => {
      const id = this.equipmentId();
      if (!id) {
        this.activeContext.setEquipment(null);
        return;
      }

      // Provisório enquanto `Equipment` não existir: o nome vem da lista
      // inventada, a mesma que a tela de equipamentos exibe. O `id` como último
      // recurso vale para uma URL digitada à mão, e é honesto — mostrar um nome
      // bonito para uma máquina que não está na lista seria inventar duas vezes.
      this.activeContext.setEquipment({ id, name: nomeDaMaquina(id) ?? id });
    });

    // Voltar para a lista de equipamentos apaga a máquina, e só ela: a empresa
    // continua em contexto, porque a pessoa continua dentro dela.
    inject(DestroyRef).onDestroy(() => this.activeContext.setEquipment(null));
  }
}
