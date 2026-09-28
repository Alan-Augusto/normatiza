import { Injectable, signal } from '@angular/core';
import type { EquipmentDetail } from '@normatiza/shared';

/**
 * A máquina em contexto, para as telas do Contexto 3.
 *
 * Provida pelo layout, e não pela raiz: vive enquanto a pessoa está dentro da
 * máquina e morre com o layout. O painel, as análises e o histórico leem daqui
 * em vez de pedir de novo à API o que o layout já trouxe.
 */
@Injectable()
export class EquipmentContext {
  readonly atual = signal<EquipmentDetail | null>(null);
  readonly carregando = signal(true);
  /** A máquina que a URL nomeia não existe para quem olha. */
  readonly inexistente = signal(false);
}
