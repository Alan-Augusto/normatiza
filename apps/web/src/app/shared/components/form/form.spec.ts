import { Component, signal } from '@angular/core';
import { ComponentFixture, TestBed } from '@angular/core/testing';
import { FormControl, ReactiveFormsModule } from '@angular/forms';

import { CampoComponent } from './campo.component';
import { MascaraDirective } from './mascara.directive';
import { MoedaComponent } from './moeda.component';
import { NumeroComponent } from './numero.component';

/**
 * Os campos de formulário do sistema (docs/web/design_system.md §9).
 *
 * O que se protege é o contrato com o formulário: o que a pessoa **vê** é
 * formatado à brasileira, e o que o formulário **guarda** é o dado cru — só
 * dígitos no documento, número de verdade na medida, centavos no dinheiro.
 */

@Component({
  standalone: true,
  imports: [ReactiveFormsModule, MascaraDirective],
  template: `<input data-testid="alvo" [appMascara]="tipo" [formControl]="controle" />`,
})
class ComMascara {
  tipo: 'cnpj' | 'cpf' | 'cep' | 'telefone' = 'cnpj';
  controle = new FormControl('', { nonNullable: true });
}

@Component({
  standalone: true,
  imports: [ReactiveFormsModule, NumeroComponent],
  template: `<app-numero inputId="n" testid="alvo" [unidade]="unidade" [casas]="casas" [agrupar]="agrupar" [formControl]="controle" />`,
})
class ComNumero {
  unidade: string | undefined = 'kg';
  casas = 0;
  agrupar = true;
  controle = new FormControl<number | null>(null);
}

@Component({
  standalone: true,
  imports: [ReactiveFormsModule, MoedaComponent],
  template: `<app-moeda inputId="m" testid="alvo" [formControl]="controle" />`,
})
class ComMoeda {
  controle = new FormControl<number | null>(null);
}

@Component({
  standalone: true,
  imports: [CampoComponent],
  template: `
    <app-campo para="x" rotulo="Nome" [marca]="marca()" [ajuda]="ajuda()" [aviso]="aviso()" [erro]="erro()" mensagemId="msg-x">
      <input id="x" />
    </app-campo>
  `,
})
class ComCampo {
  marca = signal<'obrigatorio' | 'opcional' | null>(null);
  ajuda = signal<string | null>(null);
  aviso = signal<string | null>(null);
  erro = signal<string | null>(null);
}

function montar<T>(tipo: new () => T, ajustar: (c: T) => void = () => undefined) {
  TestBed.configureTestingModule({ imports: [tipo] });
  const fixture: ComponentFixture<T> = TestBed.createComponent(tipo);
  ajustar(fixture.componentInstance);
  fixture.detectChanges();
  const alvo = (fixture.nativeElement as HTMLElement).querySelector('[data-testid="alvo"]') as HTMLInputElement;
  return { fixture, alvo, host: fixture.componentInstance };
}

function digitar(fixture: ComponentFixture<unknown>, entrada: HTMLInputElement, texto: string) {
  entrada.value = texto;
  entrada.dispatchEvent(new Event('input'));
  fixture.detectChanges();
}

function sair(fixture: ComponentFixture<unknown>, entrada: HTMLInputElement) {
  entrada.dispatchEvent(new Event('blur'));
  fixture.detectChanges();
}

describe('máscaras', () => {
  it('deve formatar o CNPJ enquanto digita e guardar só os dígitos', () => {
    const { fixture, alvo, host } = montar(ComMascara);

    digitar(fixture, alvo, '11222333000181');

    expect(alvo.value).toBe('11.222.333/0001-81');
    expect(host.controle.value).toBe('11222333000181');
  });

  it('deve aceitar o CNPJ colado já com pontuação, e ignorar o que não é dígito', () => {
    const { fixture, alvo, host } = montar(ComMascara);

    digitar(fixture, alvo, ' 11.222.333/0001-81x ');

    expect(host.controle.value).toBe('11222333000181');
  });

  it('não deve deixar passar do tamanho do documento', () => {
    const { fixture, alvo, host } = montar(ComMascara);

    digitar(fixture, alvo, '112223330001819999');

    expect(host.controle.value).toBe('11222333000181');
  });

  it('deve mostrar formatado o valor que o formulário já tinha', () => {
    const { fixture, alvo, host } = montar(ComMascara);

    host.controle.setValue('11222333000181');
    fixture.detectChanges();

    expect(alvo.value).toBe('11.222.333/0001-81');
  });

  it('deve formatar CPF e CEP', () => {
    const cpf = montar(ComMascara, (h) => (h.tipo = 'cpf'));
    digitar(cpf.fixture, cpf.alvo, '12345678909');
    expect(cpf.alvo.value).toBe('123.456.789-09');

    TestBed.resetTestingModule();
    const cep = montar(ComMascara, (h) => (h.tipo = 'cep'));
    digitar(cep.fixture, cep.alvo, '89700000');
    expect(cep.alvo.value).toBe('89700-000');
  });

  it('deve formatar telefone fixo e celular, que têm tamanhos diferentes', () => {
    const { fixture, alvo, host } = montar(ComMascara, (h) => (h.tipo = 'telefone'));

    digitar(fixture, alvo, '4934411000');
    expect(alvo.value).toBe('(49) 3441-1000');

    digitar(fixture, alvo, '49988776655');
    expect(alvo.value).toBe('(49) 98877-6655');
    expect(host.controle.value).toBe('49988776655');
  });
});

describe('app-numero', () => {
  it('deve mostrar a unidade encostada no campo, e não no rótulo', () => {
    const { fixture } = montar(ComNumero);

    expect((fixture.nativeElement as HTMLElement).querySelector('[data-testid="unidade"]')?.textContent?.trim()).toBe('kg');
  });

  it('deve guardar o número e mostrá-lo com ponto de milhar ao sair do campo', () => {
    const { fixture, alvo, host } = montar(ComNumero);

    digitar(fixture, alvo, '4200');
    expect(host.controle.value).toBe(4200);

    sair(fixture, alvo);
    expect(alvo.value).toBe('4.200');
  });

  it('deve aceitar vírgula decimal até as casas permitidas', () => {
    const { fixture, alvo, host } = montar(ComNumero, (h) => (h.casas = 2));

    digitar(fixture, alvo, '0,555');

    expect(alvo.value).toBe('0,55');
    expect(host.controle.value).toBe(0.55);
  });

  it('não deve deixar digitar letra, nem vírgula onde a medida é inteira', () => {
    const { fixture, alvo, host } = montar(ComNumero);

    digitar(fixture, alvo, '12a,5');

    expect(alvo.value).toBe('125');
    expect(host.controle.value).toBe(125);
  });

  it('deve guardar nulo quando o campo fica vazio', () => {
    const { fixture, alvo, host } = montar(ComNumero);
    digitar(fixture, alvo, '12');

    digitar(fixture, alvo, '');

    expect(host.controle.value).toBeNull();
  });

  it('não deve agrupar o que não é quantidade, como um ano', () => {
    const { fixture, alvo } = montar(ComNumero, (h) => {
      h.agrupar = false;
      h.unidade = undefined;
    });

    digitar(fixture, alvo, '2012');
    sair(fixture, alvo);

    expect(alvo.value).toBe('2012');
  });

  it('deve manter o número ao entrar e sair do campo sem editar, com o ponto de milhar na tela', () => {
    // O defeito: "4.200" relido ao sair virava 4,2 — o ponto de milhar lido como decimal.
    const { fixture, alvo, host } = montar(ComNumero);
    host.controle.setValue(4200);
    fixture.detectChanges();

    sair(fixture, alvo);

    expect(alvo.value).toBe('4.200');
    expect(host.controle.value).toBe(4200);
  });

  it('deve mostrar à brasileira o valor que o formulário já tinha', () => {
    const { fixture, alvo, host } = montar(ComNumero, (h) => (h.casas = 2));

    host.controle.setValue(7.5);
    fixture.detectChanges();

    expect(alvo.value).toBe('7,5');
  });
});

describe('app-moeda', () => {
  it('deve mostrar o R$ encostado no campo e guardar em centavos', () => {
    const { fixture, alvo, host } = montar(ComMoeda);

    digitar(fixture, alvo, '158,5');
    sair(fixture, alvo);

    expect((fixture.nativeElement as HTMLElement).querySelector('[data-testid="prefixo"]')?.textContent?.trim()).toBe('R$');
    expect(alvo.value).toBe('158,50');
    expect(host.controle.value).toBe(15850);
  });

  it('deve mostrar os centavos guardados como reais, com milhar', () => {
    const { fixture, alvo, host } = montar(ComMoeda);

    host.controle.setValue(123456);
    fixture.detectChanges();

    expect(alvo.value).toBe('1.234,56');
  });
});

describe('app-campo', () => {
  const raiz = (f: ComponentFixture<unknown>) => f.nativeElement as HTMLElement;

  it('deve ligar o rótulo ao controle', () => {
    const { fixture } = montar(ComCampo);

    expect(raiz(fixture).querySelector('label')?.getAttribute('for')).toBe('x');
  });

  it('deve marcar o obrigatório com asterisco que o leitor de tela lê como palavra', () => {
    const { fixture } = montar(ComCampo, (h) => h.marca.set('obrigatorio'));

    const label = raiz(fixture).querySelector('label')!;
    expect(label.textContent).toContain('*');
    expect(label.querySelector('.sr-only')?.textContent).toContain('obrigatório');
  });

  it('deve marcar o opcional quando é ele a minoria', () => {
    const { fixture } = montar(ComCampo, (h) => h.marca.set('opcional'));

    expect(raiz(fixture).querySelector('label')?.textContent).toContain('opcional');
  });

  it('deve mostrar na linha de baixo o erro antes do aviso, e o aviso antes da ajuda', () => {
    const { fixture, host } = montar(ComCampo, (h) => {
      h.ajuda.set('Ajuda');
      h.aviso.set('Aviso');
      h.erro.set('Erro');
    });
    const linha = () => raiz(fixture).querySelector('[data-testid="msg-x"]')!;

    expect(linha().textContent?.trim()).toBe('Erro');
    expect(linha().getAttribute('role')).toBe('alert');

    host.erro.set(null);
    fixture.detectChanges();
    expect(linha().textContent?.trim()).toBe('Aviso');

    host.aviso.set(null);
    fixture.detectChanges();
    expect(linha().textContent?.trim()).toBe('Ajuda');
    expect(linha().getAttribute('role')).toBeNull();
  });
});
