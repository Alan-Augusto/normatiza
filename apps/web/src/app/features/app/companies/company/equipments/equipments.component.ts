import { Component } from '@angular/core';
import { RouterLink } from '@angular/router';

import { MAQUINAS_PROVISORIAS } from './maquinas-provisorias';
import { empresaDaRota } from '../../../../../core/routing/empresa-da-rota';
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
  readonly maquinas = MAQUINAS_PROVISORIAS;

  private readonly empresa = empresaDaRota();

  rotaDoEquipamento(equipmentId: string): string {
    return ROTAS.empresa(this.empresa()?.slug ?? '').equipamento(equipmentId).painel;
  }
}
