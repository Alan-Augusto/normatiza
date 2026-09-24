import { Component, inject } from '@angular/core';
import { toSignal } from '@angular/core/rxjs-interop';
import { ActivatedRoute, RouterLink } from '@angular/router';
import { map } from 'rxjs/operators';

import { MAQUINAS_PROVISORIAS } from './maquinas-provisorias';
import { ROTAS } from '../../../../../core/routing/rotas';

/**
 * Inventário da planta — Contexto 2.
 *
 * **Provisória, e por um motivo diferente da tela de empresas:** ali havia dado
 * de verdade na sessão; aqui não há dado nenhum. `Equipment` não existe — nem
 * modelo no Prisma, nem tabela, nem endpoint.
 *
 * As máquinas são inventadas — vêm de `maquinas-provisorias.ts` — e a tela diz
 * isso a quem a abre. Quando o cadastro chegar, o arquivo inteiro é
 * substituído: não há nada aqui para preservar.
 */
@Component({
  selector: 'app-equipments',
  standalone: true,
  imports: [RouterLink],
  templateUrl: './equipments.component.html',
  styleUrl: './equipments.component.css',
})
export class EquipmentsComponent {
  private readonly route = inject(ActivatedRoute);

  readonly maquinas = MAQUINAS_PROVISORIAS;

  /**
   * O `companyId` vem do pai — `equipamentos` é filha de `empresas/:companyId`,
   * e `ActivatedRoute.paramMap` só enxerga os parâmetros do próprio nível.
   */
  readonly companyId = toSignal(
    this.route.parent!.paramMap.pipe(map((params) => params.get('companyId') ?? '')),
    { initialValue: this.route.parent?.snapshot.paramMap.get('companyId') ?? '' },
  );

  rotaDoEquipamento(equipmentId: string): string {
    return ROTAS.empresa(this.companyId()).equipamento(equipmentId).painel;
  }
}
