import { ComponentFixture, TestBed } from '@angular/core/testing';
import { FilterChip } from './filter-chip.component';

describe('FilterChip', () => {
  let fixture: ComponentFixture<FilterChip>;
  let component: FilterChip;

  beforeEach(async () => {
    await TestBed.configureTestingModule({ imports: [FilterChip] }).compileComponents();
    fixture = TestBed.createComponent(FilterChip);
    component = fixture.componentInstance;
  });

  it('deve renderizar o label', () => {
    fixture.componentRef.setInput('label', 'Em operação');
    fixture.detectChanges();

    expect(fixture.nativeElement.textContent).toContain('Em operação');
  });

  it('deve emitir remover ao clicar no botão de fechar', () => {
    fixture.componentRef.setInput('label', 'Em operação');
    fixture.detectChanges();

    let removido = false;
    component.remover.subscribe(() => (removido = true));

    const btn = fixture.nativeElement.querySelector('.remover-btn');
    btn.click();

    expect(removido).toBe(true);
  });
});
