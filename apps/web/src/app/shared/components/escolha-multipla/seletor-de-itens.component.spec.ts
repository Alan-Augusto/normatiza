import { TestBed } from '@angular/core/testing';

import { ModalRef } from '@core/modal/modal-ref';

import type { GrupoDeEscolha } from './escolha';
import { SeletorDeItensComponent } from './seletor-de-itens.component';

/** O corpo do modal de escolha: busca, grupos e a ordem do catálogo. */
describe('SeletorDeItensComponent', () => {
  let fechado: unknown;

  const grupo = (titulo: string, n: number, prefixo: string): GrupoDeEscolha => ({
    titulo,
    itens: Array.from({ length: n }, (_, i) => ({ id: `${prefixo}-${i + 1}`, codigo: `${prefixo}.${i + 1}`, texto: `Texto ${prefixo} ${i + 1} sobre intertravamento` })),
  });

  function abrir(grupos: GrupoDeEscolha[], escolhidos: string[] = []) {
    fechado = 'aberto';
    TestBed.configureTestingModule({
      providers: [{ provide: ModalRef, useValue: { fechar: (r: unknown) => (fechado = r) } }],
    });
    const fixture = TestBed.createComponent(SeletorDeItensComponent);
    fixture.componentRef.setInput('grupos', grupos);
    fixture.componentRef.setInput('escolhidos', escolhidos);
    fixture.detectChanges();
    return fixture;
  }

  const el = (f: ReturnType<typeof abrir>, testid: string) => (f.nativeElement as HTMLElement).querySelector<HTMLElement>(`[data-testid="${testid}"]`);
  const marcar = (f: ReturnType<typeof abrir>, id: string) => {
    el(f, `item-${id}`)!.querySelector('input')!.click();
    f.detectChanges();
  };

  it('deve abrir tudo num catálogo pequeno, e devolver na ordem do catálogo', () => {
    const f = abrir([grupo('12.4', 3, 'a'), grupo('12.6', 2, 'b')]);

    marcar(f, 'b-2');
    marcar(f, 'a-1');
    expect(el(f, 'quantos-escolhidos')?.textContent).toContain('2 escolhidos');
    el(f, 'confirmar-escolha')!.querySelector('button')!.click();

    expect(fechado).toEqual(['a-1', 'b-2']);
  });

  it('deve fechar os grupos de um catálogo grande, menos os que já têm escolha', () => {
    const f = abrir([grupo('12.1', 100, 'a'), grupo('12.2', 100, 'b')], ['b-3']);

    expect(el(f, 'item-a-1')).toBeNull();
    expect(el(f, 'item-b-3')?.querySelector('input')?.checked).toBe(true);

    el(f, 'grupo-12.1')!.click();
    f.detectChanges();
    expect(el(f, 'item-a-1')).not.toBeNull();
    el(f, 'grupo-12.2')!.click();
    f.detectChanges();
    expect(el(f, 'item-b-3')).toBeNull();
  });

  it('deve buscar pelo código ou pelo texto, sem acento', () => {
    const f = abrir([grupo('12.1', 100, 'a'), grupo('12.2', 100, 'b')]);
    const busca = el(f, 'busca-de-itens') as HTMLInputElement;

    busca.value = 'b.12';
    busca.dispatchEvent(new Event('input'));
    f.detectChanges();
    expect([...(f.nativeElement as HTMLElement).querySelectorAll('[data-testid^="item-"]')].map((e) => e.getAttribute('data-testid'))).toEqual(['item-b-12']);

    busca.value = 'INTERTRAVAMENTO';
    busca.dispatchEvent(new Event('input'));
    f.detectChanges();
    expect((f.nativeElement as HTMLElement).querySelectorAll('[data-testid^="item-"]').length).toBe(200);
  });

  it('deve cancelar sem devolver nada', () => {
    const f = abrir([grupo('12.4', 3, 'a')], ['a-1']);

    marcar(f, 'a-2');
    el(f, 'cancelar-escolha')!.querySelector('button')!.click();

    expect(fechado).toBeUndefined();
  });
});
