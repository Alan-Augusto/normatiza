import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { ComponentFixture, TestBed } from '@angular/core/testing';
import { provideNoopAnimations } from '@angular/platform-browser/animations';

import type { RiskPointDto } from '@normatiza/shared';

import { API_BASE_URL } from '../../../../../../../../../core/auth/api.config';
import { catalogosDeTeste } from '../../../../../../../../../core/services/testing/catalogos';
import { BRF } from '../../../../../../../../../core/auth/testing/sessao';
import { RiskPointsStepComponent } from './risk-points-step.component';

/**
 * A etapa dos pontos de risco ([03 §5.2](../../../../../../../../../../../docs/produto/03_navegacao_e_telas.md)):
 * o HRN se calcula enquanto se escolhe, nunca vai pela metade, e excluir renumera.
 */
describe('RiskPointsStepComponent', () => {
  const API = 'http://api.teste';
  const ANALISE = `${API}/companies/${BRF.id}/equipments/EQ-0001/analyses/1`;
  let http: HttpTestingController;
  let fixture: ComponentFixture<RiskPointsStepComponent>;
  let emitidos: RiskPointDto[][];

  const ponto = (over: Partial<RiskPointDto> = {}): RiskPointDto => ({
    id: 'p-1',
    number: 1,
    location: 'Zona de prensagem',
    hazardOriginIds: [],
    hazardConsequenceIds: ['hc-esmagamento'],
    existingProtectionIds: [],
    violatedStandardIds: [],
    ...over,
  });

  function abrir(pontos: RiskPointDto[] = [], editavel = true) {
    TestBed.configureTestingModule({
      providers: [provideHttpClient(), provideHttpClientTesting(), provideNoopAnimations(), { provide: API_BASE_URL, useValue: API }],
    });
    http = TestBed.inject(HttpTestingController);
    fixture = TestBed.createComponent(RiskPointsStepComponent);
    fixture.componentRef.setInput('alvo', { companyId: BRF.id, code: 'EQ-0001', number: 1 });
    fixture.componentRef.setInput('pontos', pontos);
    fixture.componentRef.setInput('editavel', editavel);
    emitidos = [];
    fixture.componentInstance.pontosChange.subscribe((lista) => {
      emitidos.push(lista);
      fixture.componentRef.setInput('pontos', lista);
    });
    fixture.detectChanges();
    http.expectOne(`${API}/catalogs/analysis`).flush(catalogosDeTeste());
    fixture.detectChanges();
  }

  afterEach(() => http.verify());

  const tela = () => fixture.nativeElement as HTMLElement;
  const el = (testid: string) => tela().querySelector<HTMLElement>(`[data-testid="${testid}"]`);
  function clicar(testid: string) {
    const alvo = el(testid)?.matches('button, a') ? el(testid) : el(testid)?.querySelector<HTMLElement>('button');
    if (!alvo) throw new Error(`"${testid}" não está na tela.`);
    alvo.click();
    fixture.detectChanges();
  }
  function digitar(testid: string, valor: string) {
    const campo = el(testid) as HTMLInputElement;
    campo.value = valor;
    campo.dispatchEvent(new Event('input'));
    fixture.detectChanges();
  }
  /** Os seletores do PrimeNG abrem em painel; o que se testa é o que foi escolhido. */
  const escolher = (valores: Partial<RiskPointsStepComponent['form']['value']>) => {
    fixture.componentInstance.form.patchValue(valores);
    fixture.componentInstance.form.markAsDirty();
    fixture.detectChanges();
  };
  function responder(campo: string, código: string) {
    const botões = [...el(`campo-${campo}`)!.querySelectorAll<HTMLElement>('[role="button"]')];
    botões.find((b) => b.textContent?.trim() === código)!.click();
    fixture.detectChanges();
  }
  const texto = (testid: string) => el(testid)?.textContent?.replace(/\s+/g, ' ').trim();

  it('deve dizer que não há ponto ainda, e oferecer adicionar', () => {
    abrir();

    expect(el('sem-pontos')).not.toBeNull();
    expect(el('novo-ponto')).not.toBeNull();
  });

  it('deve calcular o HRN na tela, e gravar o ponto novo pelo id gerado aqui', () => {
    abrir();
    clicar('novo-ponto');

    digitar('campo-local', 'Zona de prensagem');
    escolher({ consequencias: ['hc-esmagamento'], fe: 2.5, pe: 8, mpl: 6, np: 1 });
    expect(texto('resultado-hrn')).toContain('120 Risco Muito Alto');

    clicar('salvar-ponto');
    const req = http.expectOne((r) => r.url.startsWith(`${ANALISE}/risk-points/`));
    expect(req.request.method).toBe('PUT');
    expect(req.request.url).toMatch(/risk-points\/[0-9a-f-]{36}$/);
    expect(req.request.body).toMatchObject({
      location: 'Zona de prensagem',
      hazardConsequenceIds: ['hc-esmagamento'],
      hrn: { fe: 2.5, pe: 8, mpl: 6, np: 1 },
      safetyCategory: null,
      suggestedSolution: null,
    });
    req.flush(ponto({ currentHrn: { fe: 2.5, pe: 8, mpl: 6, np: 1, result: 120, level: 'VERY_HIGH' } }));
    fixture.detectChanges();

    expect(emitidos.at(-1)?.map((p) => p.number)).toEqual([1]);
    expect(texto('aviso-ponto')).toContain('Ponto 1 salvo');
    expect(texto('ponto-1')).toContain('120 Risco Muito Alto');
  });

  it('não deve gravar HRN pela metade', () => {
    abrir();
    clicar('novo-ponto');

    escolher({ fe: 2.5, pe: 8 });
    expect(texto('resultado-hrn')).toContain('Escolha os quatro fatores');
    clicar('salvar-ponto');

    expect(texto('erro-ponto')).toContain('quatro fatores');
  });

  it('deve mostrar a ajuda de aplicação da probabilidade escolhida', () => {
    abrir();
    clicar('novo-ponto');

    escolher({ pe: 8 });

    expect(tela().textContent).toContain('O operador realiza atividades muito próximo ao ponto');
  });

  it('deve calcular a categoria NBR 14153 e mandá-la com o ponto', () => {
    abrir();
    clicar('novo-ponto');

    escolher({ usaCategoria: true });
    // Pelos botões da tela: foi clicando que a primeira versão, com rádios, não gravava a escolha.
    responder('gravidade', 'S2');
    responder('frequencia', 'F2');
    responder('possibilidade', 'P1');
    expect(texto('resultado-categoria')).toBe('Categoria 3');
    clicar('salvar-ponto');

    const req = http.expectOne((r) => r.url.startsWith(`${ANALISE}/risk-points/`));
    expect(req.request.body.safetyCategory).toEqual({ severity: 2, frequency: 2, possibility: 1 });
    req.flush(ponto());
  });

  it('deve fechar frequência e possibilidade quando o ferimento é leve', () => {
    abrir();
    clicar('novo-ponto');
    escolher({ usaCategoria: true });

    responder('gravidade', 'S2');
    responder('frequencia', 'F2');
    responder('gravidade', 'S1');

    expect(fixture.componentInstance.form.controls.frequencia.disabled).toBe(true);
    expect(fixture.componentInstance.form.controls.frequencia.value).toBeNull();
    expect(texto('resultado-categoria')).toBe('Categoria 1');
  });

  it('deve mostrar o texto de cada item de norma escolhido, sem o "Conforme item"', () => {
    abrir();
    clicar('novo-ponto');

    escolher({ normas: ['std-1'] });

    expect(texto('normas-escolhidas')).toBe('12.5.1 as zonas de perigo devem possuir sistemas de segurança.');
  });

  it('deve gravar o ponto novo antes de enviar a foto dele', () => {
    abrir();
    clicar('novo-ponto');
    digitar('campo-local', 'Zona');

    const campo = el('foto-arquivo-ponto') as HTMLInputElement;
    Object.defineProperty(campo, 'files', { value: [new File(['x'], 'perigo.jpg', { type: 'image/jpeg' })], configurable: true });
    campo.dispatchEvent(new Event('change'));

    const gravacao = http.expectOne((r) => r.method === 'PUT' && /risk-points\/[0-9a-f-]{36}$/.test(r.url));
    const id = gravacao.request.url.split('/').at(-1)!;
    gravacao.flush(ponto({ id, location: 'Zona' }));
    http.expectOne(`${ANALISE}/risk-points/${id}/photo`).flush({ url: 'http://arq/p', thumbnailUrl: 'http://arq/p-thumb' });
    fixture.detectChanges();

    expect(el('foto-ponto')?.getAttribute('src')).toBe('http://arq/p-thumb');
  });

  it('deve renumerar os seguintes ao excluir um ponto', () => {
    abrir([ponto(), ponto({ id: 'p-2', number: 2, location: 'Painel' }), ponto({ id: 'p-3', number: 3, location: 'Descarga' })]);

    clicar('excluir-ponto-1');
    (document.querySelector('[data-testid="confirmar-exclusao-ponto"] button') as HTMLElement).click();
    const req = http.expectOne(`${ANALISE}/risk-points/p-1`);
    expect(req.request.method).toBe('DELETE');
    req.flush(null);
    fixture.detectChanges();

    expect(emitidos.at(-1)?.map((p) => [p.number, p.location])).toEqual([
      [1, 'Painel'],
      [2, 'Descarga'],
    ]);
  });

  it('deve abrir só para leitura quando a análise não se edita', () => {
    abrir([ponto()], false);

    expect(el('novo-ponto')).toBeNull();
    expect(el('excluir-ponto-1')).toBeNull();
    clicar('abrir-ponto-1');

    expect(el('salvar-ponto')).toBeNull();
    expect((el('campo-local') as HTMLInputElement).disabled).toBe(true);
  });
});
