import { registerLocaleData } from '@angular/common';
import localePt from '@angular/common/locales/pt';
import { LOCALE_ID } from '@angular/core';
import { TestBed } from '@angular/core/testing';

import type { RiskLevel } from '@normatiza/shared';

import { HrnBadgeComponent } from './hrn-badge.component';

/** O HRN como se mostra em todo lugar (docs/web/design_system.md §5). */
describe('HrnBadgeComponent', () => {
  registerLocaleData(localePt, 'pt-BR');

  function mostrar(resultado: number | undefined, nivel: RiskLevel | undefined) {
    TestBed.configureTestingModule({ providers: [{ provide: LOCALE_ID, useValue: 'pt-BR' }] });
    const fixture = TestBed.createComponent(HrnBadgeComponent);
    fixture.componentRef.setInput('resultado', resultado);
    fixture.componentRef.setInput('nivel', nivel);
    fixture.detectChanges();
    return (fixture.nativeElement as HTMLElement).querySelector('[data-testid="hrn"]')!;
  }

  it('deve escrever o número à brasileira e o nome da faixa, e não só a cor', () => {
    const selo = mostrar(2250, 'UNACCEPTABLE');

    expect(selo.textContent?.replace(/\s+/g, ' ').trim()).toBe('2.250 Risco Inaceitável');
    expect(selo.getAttribute('data-level')).toBe('UNACCEPTABLE');
  });

  it('deve mostrar a casa decimal com vírgula', () => {
    expect(mostrar(1.08, 'VERY_LOW').textContent).toContain('1,08');
  });

  it('deve mostrar "—" quando não há HRN, e não zero', () => {
    expect(mostrar(undefined, undefined).textContent?.trim()).toBe('—');
  });
});
