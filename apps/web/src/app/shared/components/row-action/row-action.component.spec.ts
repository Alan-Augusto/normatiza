import { ComponentFixture, TestBed } from '@angular/core/testing';
import { provideRouter } from '@angular/router';

import { RowActionComponent } from './row-action.component';

/**
 * A ação de linha: um ícone, com nome. O ícone economiza a largura que cinco
 * palavras gastavam em cada linha; o nome continua lá para quem não enxerga o
 * ícone — leitor de tela, teclado, e quem ainda não sabe o que ele significa.
 */
describe('RowActionComponent', () => {
  let fixture: ComponentFixture<RowActionComponent>;

  beforeEach(() => {
    TestBed.configureTestingModule({ imports: [RowActionComponent], providers: [provideRouter([])] });
    fixture = TestBed.createComponent(RowActionComponent);
  });

  function montar(entradas: Record<string, unknown>) {
    for (const [nome, valor] of Object.entries(entradas)) fixture.componentRef.setInput(nome, valor);
    fixture.detectChanges();
    return fixture.nativeElement as HTMLElement;
  }

  it('deve ter nome acessível, e não só o desenho', () => {
    const raiz = montar({ icon: 'lucidePencil', label: 'Editar' });

    const botao = raiz.querySelector('button')!;
    expect(botao.getAttribute('aria-label')).toBe('Editar');
    expect(botao.querySelector('ng-icon')).not.toBeNull();
    expect(botao.textContent?.trim()).toBe('');
  });

  it('deve avisar quem clica', () => {
    const raiz = montar({ icon: 'lucideEye', label: 'Ver dados' });
    let acionado = 0;
    fixture.componentInstance.acionar.subscribe(() => acionado++);

    raiz.querySelector('button')!.click();

    expect(acionado).toBe(1);
  });

  it('deve virar link quando a ação é ir para outra tela', () => {
    const raiz = montar({ icon: 'lucidePencil', label: 'Editar', link: ['/app/companies/edit', 'c-1'] });

    const link = raiz.querySelector('a')!;
    expect(link.getAttribute('href')).toBe('/app/companies/edit/c-1');
    expect(link.getAttribute('aria-label')).toBe('Editar');
    expect(raiz.querySelector('button')).toBeNull();
  });

  it('deve marcar a ação destrutiva com a cor de perigo', () => {
    const raiz = montar({ icon: 'lucidePower', label: 'Desativar', severity: 'danger' });

    expect(raiz.querySelector('button')!.classList).toContain('p-button-danger');
  });
});
