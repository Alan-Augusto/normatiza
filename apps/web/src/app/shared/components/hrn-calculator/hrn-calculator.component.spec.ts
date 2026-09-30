import { Component, signal } from '@angular/core';
import { ComponentFixture, TestBed } from '@angular/core/testing';
import { FormControl, ReactiveFormsModule } from '@angular/forms';

import { HRN_TABLE_LEGACY } from '@normatiza/shared';

import { HRN_VAZIO, HrnCalculatorComponent, type HrnEscolha } from './hrn-calculator.component';

@Component({
  standalone: true,
  imports: [ReactiveFormsModule, HrnCalculatorComponent],
  template: `<app-hrn-calculator [formControl]="controle" [tabela]="tabela()" />`,
})
class ComCalculadora {
  readonly tabela = signal(HRN_TABLE_LEGACY);
  readonly controle = new FormControl<HrnEscolha>({ ...HRN_VAZIO }, { nonNullable: true });
}

/**
 * A calculadora do HRN: quatro perguntas, a conta montada e a faixa na régua.
 * O que se protege é o que quem preenche vê e o que o formulário guarda.
 */
describe('HrnCalculatorComponent', () => {
  let fixture: ComponentFixture<ComCalculadora>;

  beforeEach(() => {
    fixture = TestBed.createComponent(ComCalculadora);
    fixture.detectChanges();
  });

  const tela = () => fixture.nativeElement as HTMLElement;
  const el = (testid: string) => tela().querySelector<HTMLElement>(`[data-testid="${testid}"]`);
  const texto = (testid: string) => el(testid)?.textContent?.replace(/\s+/g, ' ').trim() ?? '';
  function escolher(fator: string, peso: number) {
    el(`opcao-${fator}-${peso}`)!.querySelector('input')!.click();
    fixture.detectChanges();
  }

  it('deve perguntar cada fator em linguagem de campo, com as opções do menor para o maior peso', () => {
    expect(texto('fator-fe')).toContain('Com que frequência alguém se expõe a este perigo?');
    const pesos = [...el('fator-pe')!.querySelectorAll('.peso')].map((p) => p.textContent?.trim());
    expect(pesos).toEqual(['0,03', '1', '1,5', '2', '5', '8', '10', '15']);
  });

  it('deve montar a conta enquanto se escolhe, com "?" no que falta', () => {
    escolher('fe', 2.5);
    escolher('pe', 8);

    expect(texto('resultado-hrn')).toContain('FE 2,5');
    expect(texto('resultado-hrn')).toContain('MPL ?');
    expect(texto('resultado-hrn')).toContain('Faltam 2 fatores');
  });

  it('deve dar o resultado e a faixa, dizer os limites dela e se vira tarefa', () => {
    escolher('fe', 2.5);
    escolher('pe', 8);
    escolher('mpl', 6);
    escolher('np', 1);

    expect(texto('resultado-hrn')).toContain('120 Risco Muito Alto');
    expect(texto('explicacao-hrn')).toContain('HRN acima de 100 até 500');
    expect(texto('explicacao-hrn')).toContain('vira tarefa no plano de ação');
    expect(tela().querySelector('.faixa.atual')?.getAttribute('data-level')).toBe('VERY_HIGH');
    expect(fixture.componentInstance.controle.value).toEqual({ fe: 2.5, pe: 8, mpl: 6, np: 1 });
  });

  it('deve dizer que o risco aceitável fica no laudo e não vira tarefa', () => {
    escolher('fe', 0.5);
    escolher('pe', 0.03);
    escolher('mpl', 0.1);
    escolher('np', 1);

    expect(texto('explicacao-hrn')).toContain('não vira tarefa');
  });

  it('deve mostrar a ajuda de aplicação da probabilidade escolhida', () => {
    escolher('pe', 15);

    expect(texto('ajuda-pe')).toContain('contato físico direto contínuo');
  });

  it('deve limpar os quatro fatores de uma vez', () => {
    escolher('fe', 2.5);

    el('limpar-hrn')!.click();
    fixture.detectChanges();

    expect(fixture.componentInstance.controle.value).toEqual(HRN_VAZIO);
  });

  it('deve mostrar o valor que o formulário já tinha, e não deixar mudar quando desabilitado', () => {
    fixture.componentInstance.controle.setValue({ fe: 1, pe: 2, mpl: 4, np: 1 });
    fixture.componentInstance.controle.disable();
    fixture.detectChanges();

    expect(texto('resultado-hrn')).toContain('8 Risco Baixo');
    const opção = el('opcao-fe-5')!.querySelector('input')!;
    expect(opção.matches(':disabled')).toBe(true);
    opção.click();
    fixture.detectChanges();
    expect(fixture.componentInstance.controle.value).toEqual({ fe: 1, pe: 2, mpl: 4, np: 1 });
    expect(el('limpar-hrn')).toBeNull();
  });
});
