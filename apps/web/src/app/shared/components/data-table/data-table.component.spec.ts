import { Component, signal } from '@angular/core';
import { ComponentFixture, TestBed } from '@angular/core/testing';

import { DataTable } from './data-table.component';
import {
  AcaoPrimaria,
  AcaoVazia,
  CabecalhoDaTabela,
  FiltrosAtivos,
  FiltrosRapidos,
  LinhaDaTabela,
} from './data-table.directives';

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

describe('DataTable - Toolbar Integrada', () => {
  let fixToolbar: ComponentFixture<HospedeiroComToolbar>;
  let compToolbar: HospedeiroComToolbar;

  beforeEach(async () => {
    TestBed.resetTestingModule();
    await TestBed.configureTestingModule({ imports: [HospedeiroComToolbar] }).compileComponents();
    fixToolbar = TestBed.createComponent(HospedeiroComToolbar);
    compToolbar = fixToolbar.componentInstance;
    fixToolbar.detectChanges();
  });

  it('deve exibir contador com total e entidade', () => {
    const elContador = fixToolbar.nativeElement.querySelector('.tabela-toolbar');
    expect(elContador).not.toBeNull();
    expect(elContador.textContent).toContain('1');
    expect(elContador.textContent).toContain('pessoas');
  });

  it('deve projetar slots de filtros e ação primária', () => {
    expect(fixToolbar.nativeElement.querySelector('[data-testid="chip-ativo"]')).not.toBeNull();
    expect(fixToolbar.nativeElement.querySelector('[data-testid="filtro-rapido"]')).not.toBeNull();
    expect(fixToolbar.nativeElement.querySelector('[data-testid="cta"]')).not.toBeNull();
  });

  it('deve emitir evento de busca ao digitar no input', () => {
    const input = fixToolbar.nativeElement.querySelector('.busca-input') as HTMLInputElement;
    expect(input).not.toBeNull();
    input.value = 'teste';
    input.dispatchEvent(new Event('input'));
    fixToolbar.detectChanges();

    expect(compToolbar.busca()).toBe('teste');
  });
});

@Component({
  standalone: true,
  imports: [
    DataTable,
    CabecalhoDaTabela,
    LinhaDaTabela,
    FiltrosRapidos,
    FiltrosAtivos,
    AcaoPrimaria,
  ],
  template: `
    <app-data-table
      [dados]="pessoas()"
      entidade="pessoas"
      [termoBusca]="busca()"
      (buscaChange)="busca.set($event)"
    >
      <ng-template appFiltrosAtivos>
        <span data-testid="chip-ativo">Ativo</span>
      </ng-template>

      <ng-template appFiltrosRapidos>
        <button data-testid="filtro-rapido" type="button">Rapido</button>
      </ng-template>

      <ng-template appAcaoPrimaria>
        <button data-testid="cta" type="button">Nova</button>
      </ng-template>

      <ng-template appCabecalho>
        <tr>
          <th>Nome</th>
        </tr>
      </ng-template>

      <ng-template appLinha [appLinhaDe]="pessoas()" let-pessoa>
        <tr>
          <td>{{ pessoa.nome }}</td>
        </tr>
      </ng-template>
    </app-data-table>
  `,
})
class HospedeiroComToolbar {
  readonly pessoas = signal<Pessoa[]>([{ id: '1', nome: 'Ana' }]);
  readonly busca = signal<string>('');
}

@Component({
  standalone: true,
  imports: [DataTable, CabecalhoDaTabela, LinhaDaTabela],
  template: `
    <app-data-table
      [dados]="pessoas()"
      entidade="pessoas"
      [paginado]="paginado()"
      [modoPaginacao]="modoPaginacao()"
      [(pagina)]="pagina"
      [(itensPorPagina)]="itensPorPagina"
      [total]="total()"
    >
      <ng-template appCabecalho>
        <tr>
          <th>Nome</th>
        </tr>
      </ng-template>

      <ng-template appLinha [appLinhaDe]="pessoas()" let-pessoa>
        <tr data-testid="linha">
          <td>{{ pessoa.nome }}</td>
        </tr>
      </ng-template>
    </app-data-table>
  `,
})
class HospedeiroComPaginacao {
  readonly pessoas = signal<Pessoa[]>(
    Array.from({ length: 25 }, (_, i) => ({ id: `p-${i + 1}`, nome: `Pessoa ${i + 1}` })),
  );
  readonly paginado = signal(true);
  readonly modoPaginacao = signal<'front' | 'back'>('front');
  readonly pagina = signal(1);
  readonly itensPorPagina = signal(10);
  readonly total = signal<number | undefined>(undefined);
}

describe('DataTable - Paginação', () => {
  let fixture: ComponentFixture<HospedeiroComPaginacao>;
  let comp: HospedeiroComPaginacao;

  beforeEach(async () => {
    TestBed.resetTestingModule();
    await TestBed.configureTestingModule({ imports: [HospedeiroComPaginacao] }).compileComponents();
    fixture = TestBed.createComponent(HospedeiroComPaginacao);
    comp = fixture.componentInstance;
    fixture.detectChanges();
  });

  const todos = (seletor: string) =>
    Array.from((fixture.nativeElement as HTMLElement).querySelectorAll(seletor)) as HTMLElement[];
  const el = (seletor: string) =>
    (fixture.nativeElement as HTMLElement).querySelector(seletor) as HTMLElement | null;

  it('deve fatiar dados no front e exibir a primeira página com a quantidade configurada', () => {
    expect(todos('[data-testid="linha"]').length).toBe(10);
    const paginacao = el('[data-testid="tabela-paginacao"]');
    expect(paginacao).not.toBeNull();
    expect(paginacao!.textContent).toContain('Mostrando 1 a 10 de 25 pessoas');
    expect(el('[data-testid="paginacao-indicador"]')!.textContent).toContain('1 / 3');

    // Botões de voltar devem estar desabilitados na primeira página
    const btnAnt = el('[data-testid="paginacao-anterior"]') as HTMLButtonElement;
    expect(btnAnt.disabled).toBe(true);
  });

  it('deve navegar para a próxima página e fatiar os itens corretamente', () => {
    const btnProx = el('[data-testid="paginacao-proxima"]') as HTMLButtonElement;
    btnProx.click();
    fixture.detectChanges();

    expect(comp.pagina()).toBe(2);
    expect(todos('[data-testid="linha"]').length).toBe(10);
    expect(el('[data-testid="tabela-paginacao"]')!.textContent).toContain('Mostrando 11 a 20 de 25 pessoas');
    expect(el('[data-testid="paginacao-indicador"]')!.textContent).toContain('2 / 3');
  });

  it('deve navegar para a última página e desabilitar o botão de avançar', () => {
    const btnUltima = el('[data-testid="paginacao-ultima"]') as HTMLButtonElement;
    btnUltima.click();
    fixture.detectChanges();

    expect(comp.pagina()).toBe(3);
    expect(todos('[data-testid="linha"]').length).toBe(5);
    expect(el('[data-testid="tabela-paginacao"]')!.textContent).toContain('Mostrando 21 a 25 de 25 pessoas');

    const btnProx = el('[data-testid="paginacao-proxima"]') as HTMLButtonElement;
    expect(btnProx.disabled).toBe(true);
    expect(btnUltima.disabled).toBe(true);
  });

  it('deve alterar a quantidade de itens por página e retornar à primeira página', () => {
    // Primeiro avança para a página 2
    comp.pagina.set(2);
    fixture.detectChanges();

    const seletor = el('[data-testid="seletor-itens-por-pagina"]') as HTMLSelectElement;
    seletor.value = '25';
    seletor.dispatchEvent(new Event('change'));
    fixture.detectChanges();

    expect(comp.itensPorPagina()).toBe(25);
    expect(comp.pagina()).toBe(1);
    expect(todos('[data-testid="linha"]').length).toBe(25);
    expect(el('[data-testid="tabela-paginacao"]')!.textContent).toContain('Mostrando 1 a 25 de 25 pessoas');
  });

  it('deve suportar modo back-end recebendo itens fatiados e total do servidor', () => {
    comp.modoPaginacao.set('back');
    // Servidor enviou apenas 5 registros da página 2, mas informa que existem 50 no total
    comp.pessoas.set([
      { id: 'p-11', nome: 'Pessoa 11' },
      { id: 'p-12', nome: 'Pessoa 12' },
      { id: 'p-13', nome: 'Pessoa 13' },
      { id: 'p-14', nome: 'Pessoa 14' },
      { id: 'p-15', nome: 'Pessoa 15' },
    ]);
    comp.total.set(50);
    comp.pagina.set(2);
    comp.itensPorPagina.set(10);
    fixture.detectChanges();

    // No modo back, exibe todos os dados passados sem fatiar internamente
    expect(todos('[data-testid="linha"]').length).toBe(5);
    expect(el('[data-testid="tabela-paginacao"]')!.textContent).toContain('Mostrando 11 a 20 de 50 pessoas');
    expect(el('[data-testid="paginacao-indicador"]')!.textContent).toContain('2 / 5');

    // Ao clicar em avançar, emite a mudança de página
    const btnProx = el('[data-testid="paginacao-proxima"]') as HTMLButtonElement;
    btnProx.click();
    fixture.detectChanges();

    expect(comp.pagina()).toBe(3);
  });

  it('não deve exibir controles de paginação quando paginado for falso', () => {
    comp.paginado.set(false);
    fixture.detectChanges();

    expect(todos('[data-testid="linha"]').length).toBe(25);
    expect(el('[data-testid="tabela-paginacao"]')).toBeNull();
  });
});
