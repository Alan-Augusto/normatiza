import { TestBed } from '@angular/core/testing';
import { ActivatedRoute, convertToParamMap, provideRouter } from '@angular/router';
import { of } from 'rxjs';

import { ActiveContextService } from '../../../../../../core/services/active-context.service';
import { EquipmentLayoutComponent } from './equipment.layout';

/**
 * Contexto 3 — o layout publica a máquina em contexto, e precisa apagá-la ao
 * sair. A empresa **não** vai junto: quem volta para a lista de equipamentos
 * continua dentro da planta.
 */
describe('EquipmentLayoutComponent', () => {
  function abrirEm(equipmentId: string) {
    TestBed.resetTestingModule();
    TestBed.configureTestingModule({
      providers: [
        provideRouter([]),
        { provide: ActivatedRoute, useValue: { paramMap: of(convertToParamMap({ equipmentId })) } },
      ],
    });

    const contexto = TestBed.inject(ActiveContextService);
    contexto.setCompany({ id: 'company-brf', name: 'BRF' });

    const fixture = TestBed.createComponent(EquipmentLayoutComponent);
    fixture.detectChanges();

    return { contexto, fixture };
  }

  it('deve publicar a máquina pelo nome da lista provisória', () => {
    const { contexto } = abrirEm('eq-injetora');

    expect(contexto.equipment()?.name).toBe('Injetora de plástico');
  });

  it('deve cair no id para uma máquina que não está na lista', () => {
    // URL digitada à mão. Inventar um nome bonito seria inventar duas vezes.
    const { contexto } = abrirEm('eq-que-nao-existe');

    expect(contexto.equipment()?.name).toBe('eq-que-nao-existe');
  });

  it('deve apagar a máquina ao sair, e só ela', () => {
    const { contexto, fixture } = abrirEm('eq-injetora');

    fixture.destroy();

    expect(contexto.equipment()).toBeNull();
    expect(contexto.company()?.name).toBe('BRF');
  });
});
