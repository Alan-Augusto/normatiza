import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { ComponentFixture, TestBed } from '@angular/core/testing';
import { provideNoopAnimations } from '@angular/platform-browser/animations';

import { emptyPeAnswers, type PeDto } from '@normatiza/shared';

import { API_BASE_URL } from '../../../../../../../../../core/auth/api.config';
import { BRF } from '../../../../../../../../../core/auth/testing/sessao';
import { catalogosDeTeste } from '../../../../../../../../../core/services/testing/catalogos';
import { PeStepComponent } from './pe-step.component';

/**
 * A etapa do PE ([03 §5.2](../../../../../../../../../../../docs/produto/03_navegacao_e_telas.md)):
 * oito quesitos do legado, nascendo "Não" e "Não atende", e a foto do dispositivo.
 */
describe('PeStepComponent', () => {
  const API = 'http://api.teste';
  const ANALISE = `${API}/companies/${BRF.id}/equipments/EQ-0001/analyses/1`;
  const FOTO = { url: 'http://arq/f', thumbnailUrl: 'http://arq/f-thumb' };
  let http: HttpTestingController;
  let fixture: ComponentFixture<PeStepComponent>;
  let emitidos: PeDto[][];

  const pe = (over: Partial<PeDto> = {}): PeDto => ({
    id: 'pe-1',
    number: 1,
    location: 'Botão da lateral',
    answers: emptyPeAnswers(),
    violatedStandardIds: [],
    ...over,
  });

  function abrir(pes: PeDto[] = [], editavel = true) {
    TestBed.configureTestingModule({
      providers: [provideHttpClient(), provideHttpClientTesting(), provideNoopAnimations(), { provide: API_BASE_URL, useValue: API }],
    });
    http = TestBed.inject(HttpTestingController);
    fixture = TestBed.createComponent(PeStepComponent);
    fixture.componentRef.setInput('alvo', { companyId: BRF.id, code: 'EQ-0001', number: 1 });
    fixture.componentRef.setInput('pes', pes);
    fixture.componentRef.setInput('editavel', editavel);
    emitidos = [];
    fixture.componentInstance.pesChange.subscribe((lista) => {
      emitidos.push(lista);
      fixture.componentRef.setInput('pes', lista);
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
  function responder(testid: string, rotulo: string) {
    const botao = [...el(testid)!.querySelectorAll<HTMLElement>('[role="button"]')].find((b) => b.textContent?.trim() === rotulo);
    if (!botao) throw new Error(`"${rotulo}" não está em "${testid}".`);
    botao.click();
    fixture.detectChanges();
  }

  it('deve convidar a avaliar a primeira parada de emergência, dizendo o que é um PE', () => {
    abrir();

    expect(texto('sem-pes')).toContain('Nenhum PE avaliado ainda');
    expect(texto('sem-pes')).toContain('parada de emergência');
  });

  it('deve mostrar os oito quesitos do legado, na ordem, já em "Não" e "Não atende"', () => {
    abrir();
    clicar('primeiro-pe');

    const rotulos = [...tela().querySelectorAll('[data-testid^="quesito-pe-"] .font-medium')].map((p) => p.textContent?.trim());
    expect(rotulos).toEqual([
      'Há dispositivos de seg. instalados',
      'O dispositivo é usado para partida',
      'Pode ser acionado por outro operador',
      'É passível de burla',
      'Está identificado em língua portuguesa',
      'Exige rearme manual',
      'Apresenta retenção após acionado',
      'Acionado em extrabaixa tensão',
    ]);
    expect(texto('nao-atendem-pe')).toBe('8 não atendem');
  });

  it('deve gravar o PE novo pelo id gerado aqui ao voltar à lista', () => {
    abrir();
    clicar('primeiro-pe');

    digitar('campo-local-pe', 'Botão da lateral');
    responder('fisico-pe-manualReset', 'Sim');
    responder('nr12-pe-manualReset', 'Atende NR-12');
    expect(texto('nao-atendem-pe')).toBe('7 não atendem');

    clicar('voltar-a-lista');
    const req = http.expectOne((r) => r.method === 'PUT' && /pes\/[0-9a-f-]{36}$/.test(r.url));
    const respostas = emptyPeAnswers();
    respostas.manualReset = { physicalState: true, nr12Compliant: true };
    expect(req.request.body).toEqual({ location: 'Botão da lateral', answers: respostas, violatedStandardIds: [], solution: null });
    req.flush(pe({ answers: respostas }));
    fixture.detectChanges();

    expect(texto('aviso-pe')).toContain('PE 1 salvo');
    expect(texto('pe-1')).toContain('7 não conformidades');
    expect(texto('pe-1')).toContain('sem foto');
  });

  it('deve voltar à lista sem gravar o PE novo deixado em branco', () => {
    abrir();
    clicar('primeiro-pe');

    clicar('voltar-a-lista');

    expect(el('sem-pes')).not.toBeNull();
  });

  it('deve duplicar um PE com tudo menos a foto, gravando a cópia ao voltar à lista', () => {
    const respostas = emptyPeAnswers();
    respostas.retention = { physicalState: true, nr12Compliant: true };
    abrir([pe({ answers: respostas, solution: 'Trocar o botão.', photo: FOTO })]);

    clicar('duplicar-pe-1');
    expect(texto('editor-pe')).toContain('cópia do PE 1');
    expect(el('foto-pe')).toBeNull();

    clicar('voltar-a-lista');
    const req = http.expectOne((r) => r.method === 'PUT' && /pes\/[0-9a-f-]{36}$/.test(r.url));
    expect(req.request.url).not.toContain('pe-1');
    expect(req.request.body).toEqual({ location: 'Botão da lateral', answers: respostas, violatedStandardIds: [], solution: 'Trocar o botão.' });
    req.flush(pe({ id: 'pe-2', number: 2, answers: respostas, solution: 'Trocar o botão.' }));
    fixture.detectChanges();

    expect(emitidos.at(-1)?.map((p) => p.number)).toEqual([1, 2]);
  });

  it('deve gravar o PE novo antes de enviar a foto', () => {
    abrir();
    clicar('primeiro-pe');

    const campo = el('foto-pe-arquivo') as HTMLInputElement;
    Object.defineProperty(campo, 'files', { value: [new File(['x'], 'botao.jpg', { type: 'image/jpeg' })], configurable: true });
    campo.dispatchEvent(new Event('change'));
    const gravacao = http.expectOne((r) => r.method === 'PUT' && /pes\/[0-9a-f-]{36}$/.test(r.url));
    const id = gravacao.request.url.split('/').at(-1)!;
    gravacao.flush(pe({ id }));
    http.expectOne(`${ANALISE}/pes/${id}/photo`).flush(FOTO);
    fixture.detectChanges();

    expect(el('foto-pe')?.getAttribute('src')).toBe('http://arq/f-thumb');
  });

  it('deve oferecer só as normas da 12.6, como no legado', () => {
    abrir();

    expect(fixture.componentInstance.secoesDeNorma().map((s) => s.name)).toEqual(['12.6 Dispositivos de parada de emergência']);
  });

  it('deve renumerar os seguintes ao excluir um PE', () => {
    abrir([pe(), pe({ id: 'pe-2', number: 2, location: 'Cabo' }), pe({ id: 'pe-3', number: 3, location: 'Pedal' })]);

    clicar('excluir-pe-1');
    (document.querySelector('[data-testid="confirmar-exclusao-pe"] button') as HTMLElement).click();
    const req = http.expectOne(`${ANALISE}/pes/pe-1`);
    expect(req.request.method).toBe('DELETE');
    req.flush(null);
    fixture.detectChanges();

    expect(emitidos.at(-1)?.map((p) => [p.number, p.location])).toEqual([
      [1, 'Cabo'],
      [2, 'Pedal'],
    ]);
  });

  it('deve abrir só para leitura quando a análise não se edita', () => {
    abrir([pe()], false);

    expect(el('novo-pe')).toBeNull();
    expect(el('duplicar-pe-1')).toBeNull();
    expect(el('excluir-pe-1')).toBeNull();
    clicar('abrir-pe-1');

    expect((el('campo-local-pe') as HTMLInputElement).disabled).toBe(true);
    expect(el('foto-pe-arquivo')).toBeNull();
    clicar('voltar-a-lista');
    expect(el('pes')).not.toBeNull();
  });
});
