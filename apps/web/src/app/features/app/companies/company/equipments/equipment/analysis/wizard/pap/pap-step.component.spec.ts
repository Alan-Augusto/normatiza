import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { ComponentFixture, TestBed } from '@angular/core/testing';
import { provideNoopAnimations } from '@angular/platform-browser/animations';

import { PAP_SECTIONS, emptyPapAnswers, type PapDto } from '@normatiza/shared';

import { API_BASE_URL } from '../../../../../../../../../core/auth/api.config';
import { BRF } from '../../../../../../../../../core/auth/testing/sessao';
import { catalogosDeTeste } from '../../../../../../../../../core/services/testing/catalogos';
import { PapStepComponent } from './pap-step.component';

/**
 * A etapa do PAP ([03 §5.2](../../../../../../../../../../../docs/produto/03_navegacao_e_telas.md)):
 * três seções de seis quesitos, duas respostas em cada, e o que não atende à
 * NR-12 é o que a lista mostra.
 */
describe('PapStepComponent', () => {
  const API = 'http://api.teste';
  const ANALISE = `${API}/companies/${BRF.id}/equipments/EQ-0001/analyses/1`;
  let http: HttpTestingController;
  let fixture: ComponentFixture<PapStepComponent>;
  let emitidos: PapDto[][];

  const secoesVazias = () => Object.fromEntries(PAP_SECTIONS.map((s) => [s.key, { answers: emptyPapAnswers() }])) as PapDto['sections'];
  const pap = (over: Partial<PapDto> = {}): PapDto => ({
    id: 'pap-1',
    number: 1,
    location: 'Painel principal',
    sections: secoesVazias(),
    violatedStandardIds: [],
    ...over,
  });

  function abrir(paps: PapDto[] = [], editavel = true) {
    TestBed.configureTestingModule({
      providers: [provideHttpClient(), provideHttpClientTesting(), provideNoopAnimations(), { provide: API_BASE_URL, useValue: API }],
    });
    http = TestBed.inject(HttpTestingController);
    fixture = TestBed.createComponent(PapStepComponent);
    fixture.componentRef.setInput('alvo', { companyId: BRF.id, code: 'EQ-0001', number: 1 });
    fixture.componentRef.setInput('paps', paps);
    fixture.componentRef.setInput('editavel', editavel);
    emitidos = [];
    fixture.componentInstance.papsChange.subscribe((lista) => {
      emitidos.push(lista);
      fixture.componentRef.setInput('paps', lista);
    });
    fixture.detectChanges();
    http.expectOne(`${API}/catalogs/analysis`).flush(catalogosDeTeste());
    fixture.detectChanges();
  }

  afterEach(() => http.verify());

  const tela = () => fixture.nativeElement as HTMLElement;
  const el = (testid: string) => tela().querySelector<HTMLElement>(`[data-testid="${testid}"]`);
  const texto = (testid: string) => el(testid)?.textContent?.replace(/\s+/g, ' ').trim() ?? '';
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
  /** Pelos botões da tela, como quem responde em campo. */
  function responder(testid: string, rotulo: string) {
    const botoes = [...el(testid)!.querySelectorAll<HTMLElement>('[role="button"]')];
    const botao = botoes.find((b) => b.textContent?.trim() === rotulo);
    if (!botao) throw new Error(`"${rotulo}" não está em "${testid}".`);
    botao.click();
    fixture.detectChanges();
  }

  it('deve convidar a avaliar o primeiro conjunto de comando, dizendo o que é um PAP', () => {
    abrir();

    expect(texto('sem-paps')).toContain('Nenhum PAP avaliado ainda');
    expect(texto('sem-paps')).toContain('Cada painel ou botoeira');
    expect(el('primeiro-pap')).not.toBeNull();
  });

  it('deve gravar o PAP novo pelo id gerado aqui, com as três seções inteiras', () => {
    abrir();
    clicar('primeiro-pap');

    digitar('campo-local-pap', 'Painel principal');
    responder('fisico-activation-installed', 'Sim');
    responder('nr12-activation-installed', 'Atende');
    responder('fisico-activation-extraLowVoltage', 'Não');
    responder('nr12-activation-extraLowVoltage', 'Não atende');

    expect(texto('aba-activation')).toContain('2/6');
    expect(texto('aba-activation')).toContain('1 não atende');
    expect(el('quesito-activation-extraLowVoltage')?.classList).toContain('nao-conforme');

    clicar('salvar-pap');
    const req = http.expectOne((r) => r.url.startsWith(`${ANALISE}/paps/`));
    expect(req.request.method).toBe('PUT');
    expect(req.request.url).toMatch(/paps\/[0-9a-f-]{36}$/);
    const ativacao = emptyPapAnswers();
    ativacao.installed = { physicalState: true, nr12Compliant: true };
    ativacao.extraLowVoltage = { physicalState: false, nr12Compliant: false };
    expect(req.request.body).toEqual({
      location: 'Painel principal',
      sections: { activation: { answers: ativacao }, reset: { answers: emptyPapAnswers() }, emergencyStop: { answers: emptyPapAnswers() } },
      violatedStandardIds: [],
      solution: null,
    });
    req.flush(pap({ sections: { ...secoesVazias(), activation: { answers: ativacao } } }));
    fixture.detectChanges();

    expect(texto('aviso-pap')).toContain('PAP 1 salvo');
    expect(texto('pap-1')).toContain('1 não conformidade');
    expect(texto('pap-1')).toContain('16 quesitos sem resposta');
  });

  it('deve guardar a resposta de cada seção ao trocar de aba', () => {
    abrir();
    clicar('primeiro-pap');

    clicar('aba-emergencyStop');
    responder('nr12-emergencyStop-installed', 'Não atende');
    clicar('aba-activation');
    expect(el('secao-emergencyStop')).toBeNull();
    clicar('aba-emergencyStop');

    expect(el('quesito-emergencyStop-installed')?.classList).toContain('nao-conforme');
    expect(texto('aba-emergencyStop')).toContain('1 não atende');
  });

  it('deve limpar a resposta ao clicar de novo nela: o que não foi verificado fica sem resposta', () => {
    abrir();
    clicar('primeiro-pap');

    responder('nr12-activation-antiFraud', 'Não atende');
    responder('nr12-activation-antiFraud', 'Não atende');

    expect(fixture.componentInstance.resposta('activation', 'antiFraud').controls.nr12Compliant.value).toBeNull();
    expect(texto('aba-activation')).toContain('0/6');
  });

  it('deve dizer que o PAP atende quando tudo foi respondido e nada falha', () => {
    const tudo = emptyPapAnswers();
    for (const k of Object.keys(tudo) as (keyof typeof tudo)[]) tudo[k] = { physicalState: true, nr12Compliant: true };
    abrir([pap({ sections: { activation: { answers: tudo }, reset: { answers: tudo }, emergencyStop: { answers: tudo } } })]);

    expect(texto('pap-1')).toContain('Atende à NR-12');
  });

  it('deve gravar o PAP novo antes de enviar a foto da seção', () => {
    abrir();
    clicar('primeiro-pap');
    clicar('aba-emergencyStop');

    const campo = el('foto-emergencyStop-arquivo') as HTMLInputElement;
    Object.defineProperty(campo, 'files', { value: [new File(['x'], 'botao.jpg', { type: 'image/jpeg' })], configurable: true });
    campo.dispatchEvent(new Event('change'));

    const gravacao = http.expectOne((r) => r.method === 'PUT' && /paps\/[0-9a-f-]{36}$/.test(r.url));
    const id = gravacao.request.url.split('/').at(-1)!;
    gravacao.flush(pap({ id }));
    http.expectOne(`${ANALISE}/paps/${id}/photos/emergencyStop`).flush({ url: 'http://arq/b', thumbnailUrl: 'http://arq/b-thumb' });
    fixture.detectChanges();

    expect(el('foto-emergencyStop')?.getAttribute('src')).toBe('http://arq/b-thumb');
    expect(emitidos.at(-1)?.[0].sections.emergencyStop.photo?.thumbnailUrl).toBe('http://arq/b-thumb');
  });

  it('deve recusar foto que não é imagem sem enviar nada', () => {
    abrir([pap()]);
    clicar('abrir-pap-1');

    const campo = el('foto-activation-arquivo') as HTMLInputElement;
    Object.defineProperty(campo, 'files', { value: [new File(['x'], 'laudo.pdf', { type: 'application/pdf' })], configurable: true });
    campo.dispatchEvent(new Event('change'));
    fixture.detectChanges();

    expect(texto('foto-activation-erro')).toContain('PNG, JPG ou WebP');
  });

  it('deve renumerar os seguintes ao excluir um PAP', () => {
    abrir([pap(), pap({ id: 'pap-2', number: 2, location: 'Botoeira' }), pap({ id: 'pap-3', number: 3, location: 'Descarga' })]);

    clicar('excluir-pap-1');
    (document.querySelector('[data-testid="confirmar-exclusao-pap"] button') as HTMLElement).click();
    const req = http.expectOne(`${ANALISE}/paps/pap-1`);
    expect(req.request.method).toBe('DELETE');
    req.flush(null);
    fixture.detectChanges();

    expect(emitidos.at(-1)?.map((p) => [p.number, p.location])).toEqual([
      [1, 'Botoeira'],
      [2, 'Descarga'],
    ]);
  });

  it('deve abrir só para leitura quando a análise não se edita', () => {
    abrir([pap()], false);

    expect(el('novo-pap')).toBeNull();
    expect(el('excluir-pap-1')).toBeNull();
    expect(el('adicionar-outro-pap')).toBeNull();
    clicar('abrir-pap-1');

    expect(el('salvar-pap')).toBeNull();
    expect((el('campo-local-pap') as HTMLInputElement).disabled).toBe(true);
    expect(el('foto-activation-arquivo')).toBeNull();
  });
});
