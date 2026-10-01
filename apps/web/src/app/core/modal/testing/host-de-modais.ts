import { ComponentFixture, TestBed } from '@angular/core/testing';

import { ModalHostComponent } from '../modal-host.component';

/**
 * O `<app-modal-host>` para o teste de uma tela: sem ele, o que a tela abre
 * pelo `ModalService` não aparece. Vai direto no `body`, sem o `id` de raiz:
 * o TestBed apaga da página todo `[id^=root]` a cada `createComponent`, e a
 * tela é criada depois do host.
 */
export function hostDeModais() {
  const host = TestBed.createComponent(ModalHostComponent);
  const elemento = host.nativeElement as HTMLElement;
  elemento.removeAttribute('id');
  document.body.appendChild(elemento);
  host.componentRef.onDestroy(() => elemento.remove());
  host.autoDetectChanges();
  return host;
}

/**
 * A tela inteira — a página e o modal aberto por cima dela — como um fixture,
 * para os ajudantes de `core/testing/prime.ts` acharem o que está no modal.
 */
export function telaComModais(pagina: () => ComponentFixture<unknown>, modais: () => ComponentFixture<unknown>) {
  return {
    get nativeElement() {
      return document.body;
    },
    detectChanges() {
      pagina().detectChanges();
      modais().detectChanges();
    },
  } as unknown as ComponentFixture<unknown>;
}
