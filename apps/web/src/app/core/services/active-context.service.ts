import { Injectable, signal } from '@angular/core';

/** Identificação de uma entidade em contexto (Contexto 2 e Contexto 3). */
export interface ContextEntity {
  id: string;
  name: string;
}

/**
 * Guarda qual empresa e qual equipamento estão em contexto.
 *
 * Quem alimenta este serviço são os layouts de contexto (`company.layout.ts` e
 * `equipment.layout.ts`), a partir dos parâmetros da rota. As telas apenas leem —
 * nunca renderizam o nome da empresa ou do equipamento como cabeçalho próprio.
 */
@Injectable({ providedIn: 'root' })
export class ActiveContextService {
  private readonly _company = signal<ContextEntity | null>(null);
  private readonly _equipment = signal<ContextEntity | null>(null);

  readonly company = this._company.asReadonly();
  readonly equipment = this._equipment.asReadonly();

  setCompany(company: ContextEntity | null): void {
    this._company.set(company);
    if (!company) this._equipment.set(null);
  }

  setEquipment(equipment: ContextEntity | null): void {
    this._equipment.set(equipment);
  }
}
