import { Component, inject, input, output, signal } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { Router, provideRouter } from '@angular/router';
import { provideNoopAnimations } from '@angular/platform-browser/animations';
import { Subject, throwError } from 'rxjs';

import { ModalRef } from './modal-ref';
import { ModalService } from './modal.service';
import { hostDeModais } from './testing/host-de-modais';

@Component({
  standalone: true,
  template: `<p data-testid="saudacao">Olá, {{ nome() }}</p>
    <button data-testid="avisar" (click)="avisou.emit('oi')">avisar</button>
    <button data-testid="pronto" (click)="ref.fechar(42)">pronto</button>`,
})
class Conteudo {
  readonly ref = inject<ModalRef<number>>(ModalRef);
  readonly nome = input('');
  readonly avisou = output<string>();
}

@Component({ standalone: true, template: '' })
class Vazio {}

/** O modal do sistema: um `p-dialog` só, desenhando o componente que se pede. */
describe('ModalService', () => {
  let service: ModalService;
  let host: ReturnType<typeof hostDeModais>;

  beforeEach(() => {
    TestBed.configureTestingModule({ providers: [provideNoopAnimations(), provideRouter([{ path: 'outra', component: Vazio }])] });
    service = TestBed.inject(ModalService);
    host = hostDeModais();
  });

  const doc = (testid: string) => document.querySelector<HTMLElement>(`[data-testid="${testid}"]`);
  const passar = async () => {
    host.detectChanges();
    await host.whenStable();
  };

  afterEach(() => service.fecharTodos());

  it('deve desenhar o componente com o título, as entradas e as saídas, e devolver o resultado', async () => {
    const avisos: unknown[] = [];
    const ref = service.abrir<number>(Conteudo, { titulo: 'Um modal', entradas: { nome: 'Fernando' }, saidas: { avisou: (v) => avisos.push(v) } });
    await passar();

    expect(document.querySelector('.p-dialog-title')?.textContent).toContain('Um modal');
    expect(doc('saudacao')?.textContent).toContain('Olá, Fernando');
    doc('avisar')!.click();
    expect(avisos).toEqual(['oi']);

    doc('pronto')!.click();
    expect(await ref.fechado).toBe(42);
    await passar();
    expect(doc('saudacao')).toBeNull();
  });

  it('deve acompanhar ao vivo a entrada que é signal', async () => {
    const nome = signal('ninguém');
    service.abrir(Conteudo, { titulo: 'Um modal', entradas: { nome } });
    await passar();
    expect(doc('saudacao')?.textContent).toContain('Olá, ninguém');

    nome.set('Carla');
    await passar();

    expect(doc('saudacao')?.textContent).toContain('Olá, Carla');
  });

  it('deve confirmar, esperando a ação terminar com o botão carregando', async () => {
    const acao = new Subject<void>();
    const resposta = service.confirmar({ titulo: 'Excluir o Ponto 1', texto: 'Não tem volta.', confirmar: 'Excluir', acao: () => acao, testid: 'confirmar-x' });
    await passar();

    doc('confirmar-x')!.querySelector('button')!.click();
    await passar();
    expect(doc('saudacao')).toBeNull();
    expect(document.querySelector('.p-dialog')).not.toBeNull();
    acao.complete();

    expect(await resposta).toBe(true);
  });

  it('deve dizer não ao cancelar, e quando a ação falha', async () => {
    const cancelada = service.confirmar({ titulo: 'T', texto: 'X', confirmar: 'Excluir' });
    await passar();
    doc('cancelar-confirmacao')!.querySelector('button')!.click();
    expect(await cancelada).toBe(false);

    const falha = service.confirmar({ titulo: 'T', texto: 'X', confirmar: 'Excluir', acao: () => throwError(() => new Error('fora do ar')), testid: 'c' });
    await passar();
    doc('c')!.querySelector('button')!.click();
    expect(await falha).toBe(false);
  });

  it('deve fechar os modais ao trocar de página', async () => {
    const ref = service.abrir(Conteudo, { titulo: 'Um modal' });
    await passar();

    await TestBed.inject(Router).navigateByUrl('/outra');

    expect(await ref.fechado).toBeUndefined();
    expect(service.abertos()).toEqual([]);
  });
});
