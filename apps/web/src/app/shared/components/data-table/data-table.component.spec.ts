import { Component, signal } from '@angular/core';
import { ComponentFixture, TestBed } from '@angular/core/testing';

import { DataTable } from './data-table.component';
import { AcaoVazia, CabecalhoDaTabela, LinhaDaTabela } from './data-table.directives';

interface Pessoa {
  id: string;
  nome: string;
}

/**
 * A tabela compartilhada.
 *
 * O que se testa aqui não é a marcação — é a razão de o componente existir:
 * "ainda buscando", "não há nada" e "aqui está" precisam ser **três coisas
 * distintas** na tela. Antes disso, as três telas mostravam zero linha em
 * silêncio nos três casos, e quem olhava não sabia se esperava, se agia, ou se
 * o sistema tinha quebrado.
 */
@Component({
  standalone: true,
  imports: [DataTable, CabecalhoDaTabela, LinhaDaTabela, AcaoVazia],
  template: `
    <app-data-table
      [dados]="pessoas()"
      [carregando]="carregando()"
      vazio="Ninguém por aqui."
      vazioDetalhe="Convide a primeira pessoa."
    >
      <ng-template appCabecalho>
        <tr>
          <th>Nome</th>
        </tr>
      </ng-template>

      <ng-template appLinha [appLinhaDe]="pessoas()" let-pessoa>
        <tr data-testid="linha" [attr.data-id]="pessoa.id">
          <td>{{ pessoa.nome }}</td>
        </tr>
      </ng-template>

      @if (ofereceAcao()) {
        <ng-template appAcaoVazia>
          <button data-testid="acao-vazia" type="button">Convidar</button>
        </ng-template>
      }
    </app-data-table>
  `,
})
class HospedeiroDeTeste {
  readonly pessoas = signal<Pessoa[]>([]);
  readonly carregando = signal(false);
  readonly ofereceAcao = signal(false);
}

describe('DataTable', () => {
  let fixture: ComponentFixture<HospedeiroDeTeste>;
  let hospedeiro: HospedeiroDeTeste;

  beforeEach(async () => {
    await TestBed.configureTestingModule({ imports: [HospedeiroDeTeste] }).compileComponents();

    fixture = TestBed.createComponent(HospedeiroDeTeste);
    hospedeiro = fixture.componentInstance;
    fixture.detectChanges();
  });

  const el = (seletor: string) =>
    (fixture.nativeElement as HTMLElement).querySelector(seletor) as HTMLElement | null;
  const todos = (seletor: string) =>
    Array.from((fixture.nativeElement as HTMLElement).querySelectorAll(seletor)) as HTMLElement[];
  const texto = () => (fixture.nativeElement as HTMLElement).textContent ?? '';

  function estado(pessoas: Pessoa[], carregando = false) {
    hospedeiro.pessoas.set(pessoas);
    hospedeiro.carregando.set(carregando);
    fixture.detectChanges();
  }

  const ANA: Pessoa = { id: 'p-1', nome: 'Ana' };
  const BRUNO: Pessoa = { id: 'p-2', nome: 'Bruno' };

  describe('os três estados', () => {
    it('deve mostrar o esqueleto enquanto a primeira carga não chegou', () => {
      estado([], true);

      expect(el('[data-testid="tabela-carregando"]')).not.toBeNull();
      // Vazio e carregando não podem ser a mesma tela: uma pede espera, a
      // outra pede ação.
      expect(el('[data-testid="tabela-vazia"]')).toBeNull();
    });

    it('deve dizer que não há nada, quando de fato não há', () => {
      estado([]);

      expect(el('[data-testid="tabela-vazia"]')).not.toBeNull();
      expect(texto()).toContain('Ninguém por aqui.');
      expect(texto()).toContain('Convide a primeira pessoa.');
      expect(el('[data-testid="tabela-carregando"]')).toBeNull();
    });

    it('deve mostrar as linhas quando há dados', () => {
      estado([ANA, BRUNO]);

      expect(todos('[data-testid="linha"]').length).toBe(2);
      expect(el('[data-testid="tabela-vazia"]')).toBeNull();
      expect(el('[data-testid="tabela-carregando"]')).toBeNull();
    });

    it('não deve mostrar o vazio enquanto recarrega com dados na tela', () => {
      // Trocar um filtro não pode apagar o que já está à vista e escrever
      // "ninguém encontrado" por um instante — parece resultado, e não é.
      estado([ANA]);
      estado([ANA], true);

      expect(el('[data-testid="tabela-vazia"]')).toBeNull();
    });
  });

  describe('o que cada tela declara', () => {
    it('deve renderizar as células no vocabulário da tela que chamou', () => {
      estado([ANA]);

      expect(el('[data-testid="linha"]')!.getAttribute('data-id')).toBe('p-1');
      expect(el('[data-testid="linha"]')!.textContent).toContain('Ana');
    });

    it('deve oferecer a ação da tela vazia, quando a tela oferece uma', () => {
      hospedeiro.ofereceAcao.set(true);
      estado([]);

      expect(el('[data-testid="acao-vazia"]')).not.toBeNull();
    });

    it('não deve inventar ação quando a tela não ofereceu nenhuma', () => {
      // Um Técnico não convida ninguém. Uma tela vazia que oferece o que a
      // pessoa não pode fazer é a mesma promessa falsa do botão desabilitado.
      estado([]);

      expect(el('[data-testid="tabela-vazia"]')).not.toBeNull();
      expect(el('[data-testid="acao-vazia"]')).toBeNull();
    });
  });
});
