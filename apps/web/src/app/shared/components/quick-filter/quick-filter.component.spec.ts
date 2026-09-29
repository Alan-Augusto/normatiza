import { ComponentFixture, TestBed } from '@angular/core/testing';
import { QuickFilter } from './quick-filter.component';

describe('QuickFilter', () => {
  let fixture: ComponentFixture<QuickFilter>;
  let component: QuickFilter;

  beforeEach(async () => {
    await TestBed.configureTestingModule({ imports: [QuickFilter] }).compileComponents();
    fixture = TestBed.createComponent(QuickFilter);
    component = fixture.componentInstance;
  });

  it('deve renderizar botão com ícone e sem badge por padrão', () => {
    fixture.componentRef.setInput('icon', 'lucideClock');
    fixture.componentRef.setInput('label', 'Aguardando Gestor');
    fixture.detectChanges();

    const btn = fixture.nativeElement.querySelector('button');
    expect(btn).not.toBeNull();
    expect(btn.getAttribute('aria-label')).toBe('Aguardando Gestor');
    expect(fixture.nativeElement.querySelector('.micro-badge')).toBeNull();
  });

  it('deve renderizar micro-badge quando o valor for maior que zero', () => {
    fixture.componentRef.setInput('icon', 'lucideClock');
    fixture.componentRef.setInput('label', 'Aguardando Gestor');
    fixture.componentRef.setInput('badge', 5);
    fixture.detectChanges();

    const badge = fixture.nativeElement.querySelector('.micro-badge');
    expect(badge).not.toBeNull();
    expect(badge.textContent.trim()).toBe('5');
  });

  it('deve aplicar classe ativo quando ativo() for true', () => {
    fixture.componentRef.setInput('icon', 'lucideClock');
    fixture.componentRef.setInput('label', 'Aguardando Gestor');
    fixture.componentRef.setInput('ativo', true);
    fixture.detectChanges();

    const btn = fixture.nativeElement.querySelector('button');
    expect(btn.classList.contains('ativo')).toBe(true);
    expect(btn.getAttribute('aria-pressed')).toBe('true');
  });

  it('deve emitir acionar ao clicar no botão', () => {
    fixture.componentRef.setInput('icon', 'lucideClock');
    fixture.componentRef.setInput('label', 'Aguardando Gestor');
    fixture.detectChanges();

    let acionado = false;
    component.acionar.subscribe(() => (acionado = true));

    const btn = fixture.nativeElement.querySelector('button');
    btn.click();

    expect(acionado).toBe(true);
  });
});
