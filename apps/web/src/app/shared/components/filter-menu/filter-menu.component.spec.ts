import { ComponentFixture, TestBed } from '@angular/core/testing';
import { FilterGroup, FilterMenuComponent } from './filter-menu.component';

describe('FilterMenuComponent', () => {
  let fixture: ComponentFixture<FilterMenuComponent>;
  let component: FilterMenuComponent;

  const gruposMock: FilterGroup[] = [
    {
      id: 'status',
      label: 'Situação',
      selectedValue: null,
      options: [
        { label: 'Ativa', value: 'ACTIVE' },
        { label: 'Inativa', value: 'INACTIVE' },
      ],
    },
    {
      id: 'setor',
      label: 'Setor',
      selectedValue: 'sec-1',
      options: [
        { label: 'Usinagem', value: 'sec-1', count: 5 },
        { label: 'Pintura', value: 'sec-2', count: 2 },
      ],
    },
  ];

  beforeEach(() => {
    TestBed.configureTestingModule({
      imports: [FilterMenuComponent],
    });
    fixture = TestBed.createComponent(FilterMenuComponent);
    component = fixture.componentInstance;
    fixture.componentRef.setInput('groups', gruposMock);
    fixture.detectChanges();
  });

  it('deve renderizar o botão de filtro com badge refletindo o total de ativos', () => {
    const badge = fixture.nativeElement.querySelector('[data-testid="filtro-badge"]');
    expect(badge).not.toBeNull();
    expect(badge.textContent.trim()).toBe('1');
  });

  it('deve alternar a visibilidade do menu principal ao clicar no trigger', () => {
    const trigger = fixture.nativeElement.querySelector('[data-testid="filtro-trigger"]');
    expect(component.menuAberto()).toBe(false);

    trigger.click();
    fixture.detectChanges();
    expect(component.menuAberto()).toBe(true);

    trigger.click();
    fixture.detectChanges();
    expect(component.menuAberto()).toBe(false);
  });

  it('deve abrir o submenu ao clicar ou hover em um grupo', () => {
    component.menuAberto.set(true);
    fixture.detectChanges();

    const grupoStatus = fixture.nativeElement.querySelector('[data-testid="filtro-status"]');
    grupoStatus.click();
    fixture.detectChanges();

    expect(component.submenuAberto()).toBe('status');
    const submenu = fixture.nativeElement.querySelector('[data-testid="submenu-status"]');
    expect(submenu.classList.contains('hidden')).toBe(false);
  });

  it('deve emitir change ao selecionar uma opção', () => {
    let eventoEmitido: { groupId: string; value: unknown | null } | null = null;
    component.change.subscribe((evt) => (eventoEmitido = evt));

    component.menuAberto.set(true);
    component.submenuAberto.set('status');
    fixture.detectChanges();

    const opcaoInativa = fixture.nativeElement.querySelector('[data-opcao="Inativa"]');
    opcaoInativa.click();
    fixture.detectChanges();

    expect(eventoEmitido).toEqual({ groupId: 'status', value: 'INACTIVE' });
  });

  it('deve emitir null ao selecionar a opção que já está ativa (desmarcar)', () => {
    let eventoEmitido: { groupId: string; value: unknown | null } | null = null;
    component.change.subscribe((evt) => (eventoEmitido = evt));

    component.menuAberto.set(true);
    component.submenuAberto.set('setor');
    fixture.detectChanges();

    const opcaoUsinagem = fixture.nativeElement.querySelector('[data-opcao="Usinagem"]');
    opcaoUsinagem.click();
    fixture.detectChanges();

    expect(eventoEmitido).toEqual({ groupId: 'setor', value: null });
  });

  it('deve fechar ao pressionar ESC', () => {
    component.menuAberto.set(true);
    component.submenuAberto.set('status');
    fixture.detectChanges();

    window.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape' }));
    fixture.detectChanges();

    expect(component.menuAberto()).toBe(false);
    expect(component.submenuAberto()).toBeNull();
  });
});
