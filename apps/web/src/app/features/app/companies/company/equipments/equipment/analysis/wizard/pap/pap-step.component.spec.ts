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

  const FOTO = { url: 'http://arq/f', thumbnailUrl: 'http://arq/f-thumb' };
  function enviarFoto(secao: string) {
    const campo = el(`foto-${secao}-arquivo`) as HTMLInputElement;
    Object.defineProperty(campo, 'files', { value: [new File(['x'], 'botao.jpg', { type: 'image/jpeg' })], configurable: true });
    campo.dispatchEvent(new Event('change'));
    fixture.detectChanges();
  }

  it('deve convidar a avaliar o primeiro conjunto de comando, dizendo o que é um PAP', () => {
    abrir();

    expect(texto('sem-paps')).toContain('Nenhum PAP avaliado ainda');
    expect(texto('sem-paps')).toContain('partida, acionamento e parada');
    expect(el('primeiro-pap')).not.toBeNull();
  });

  it('deve abrir os quesitos da seção depois da foto, já em "Não" e "Não atende", e gravar o PAP antes da foto', () => {
    abrir();
    clicar('primeiro-pap');
    digitar('campo-local-pap', 'Painel principal');

    expect(el('sem-foto-activation')).not.toBeNull();
    expect(el('quesito-activation-installed')).toBeNull();
    expect(texto('aba-activation')).toContain('Sem foto');

    enviarFoto('activation');
    const gravacao = http.expectOne((r) => r.method === 'PUT' && /paps\/[0-9a-f-]{36}$/.test(r.url));
    const id = gravacao.request.url.split('/').at(-1)!;
    expect(gravacao.request.body.location).toBe('Painel principal');
    gravacao.flush(pap({ id }));
    http.expectOne(`${ANALISE}/paps/${id}/photos/activation`).flush(FOTO);
    fixture.detectChanges();

    expect(el('foto-activation')?.getAttribute('src')).toBe('http://arq/f-thumb');
    expect(el('quesito-activation-installed')?.classList).toContain('nao-conforme');
    expect(texto('aba-activation')).toContain('6 não atendem');
  });

  it('deve gravar as respostas ao voltar à lista, e a lista contar só as seções com foto', () => {
    abrir([pap({ sections: { ...secoesVazias(), activation: { answers: emptyPapAnswers(), photo: FOTO } } })]);
    clicar('abrir-pap-1');

    responder('fisico-activation-installed', 'Sim');
    responder('nr12-activation-installed', 'Atende NR-12');
    responder('nr12-activation-accidental', 'Atende NR-12');
    expect(el('quesito-activation-installed')?.classList).not.toContain('nao-conforme');
    expect(texto('aba-activation')).toContain('4 não atendem');

    clicar('voltar-a-lista');
    const req = http.expectOne(`${ANALISE}/paps/pap-1`);
    const partida = emptyPapAnswers();
    partida.installed = { physicalState: true, nr12Compliant: true };
    partida.accidental = { physicalState: false, nr12Compliant: true };
    expect(req.request.body).toEqual({
      location: 'Painel principal',
      sections: { activation: { answers: partida }, stop: { answers: emptyPapAnswers() }, reset: { answers: emptyPapAnswers() } },
      violatedStandardIds: [],
      solution: null,
    });
    req.flush(pap({ sections: { ...secoesVazias(), activation: { answers: partida, photo: FOTO } } }));
    fixture.detectChanges();

    expect(texto('aviso-pap')).toContain('PAP 1 salvo');
    expect(texto('pap-1')).toContain('4 não conformidades');
    expect(texto('pap-1')).toContain('Parada sem foto');
  });

  it('deve voltar à lista sem gravar o PAP novo deixado em branco', () => {
    abrir();
    clicar('primeiro-pap');

    clicar('voltar-a-lista');

    expect(el('sem-paps')).not.toBeNull();
  });

  it('deve duplicar um PAP com tudo menos as fotos, como no legado', () => {
    const partida = emptyPapAnswers();
    partida.installed = { physicalState: true, nr12Compliant: true };
    abrir([pap({ sections: { ...secoesVazias(), activation: { answers: partida, photo: FOTO } }, solution: 'Trocar a botoeira.' })]);

    clicar('duplicar-pap-1');
    expect(texto('editor-pap')).toContain('cópia do PAP 1');
    expect(el('sem-foto-activation')).not.toBeNull();

    clicar('voltar-a-lista');
    const req = http.expectOne((r) => r.method === 'PUT' && /paps\/[0-9a-f-]{36}$/.test(r.url));
    expect(req.request.body.sections.activation.answers.installed).toEqual({ physicalState: true, nr12Compliant: true });
    expect(req.request.body.solution).toBe('Trocar a botoeira.');
    req.flush(pap({ id: 'pap-2', number: 2 }));
  });

  it('deve guardar a resposta de cada seção ao trocar de aba', () => {
    abrir([pap({ sections: { ...secoesVazias(), activation: { answers: emptyPapAnswers(), photo: FOTO }, stop: { answers: emptyPapAnswers(), photo: FOTO } } })]);
    clicar('abrir-pap-1');

    clicar('aba-stop');
    responder('nr12-stop-installed', 'Atende NR-12');
    clicar('aba-activation');
    expect(el('secao-stop')).toBeNull();
    clicar('aba-stop');

    expect(el('quesito-stop-installed')?.classList).not.toContain('nao-conforme');
    expect(texto('aba-stop')).toContain('5 não atendem');
  });

  it('deve dizer que o PAP atende quando nada falha nas seções avaliadas, e que sem foto nada foi avaliado', () => {
    const tudo = emptyPapAnswers();
    for (const k of Object.keys(tudo) as (keyof typeof tudo)[]) tudo[k] = { physicalState: true, nr12Compliant: true };
    abrir([
      pap({ sections: { ...secoesVazias(), reset: { answers: tudo, photo: FOTO } } }),
      pap({ id: 'pap-2', number: 2 }),
    ]);

    expect(texto('pap-1')).toContain('Atende à NR-12');
    expect(texto('pap-2')).toContain('Sem seção avaliada');
  });

  it('deve oferecer só as normas da 12.4, como no legado', () => {
    abrir();

    expect(fixture.componentInstance.secoesDeNorma().map((s) => s.name)).toEqual(['12.4 Dispositivos de partida, acionamento e parada']);
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
    abrir([pap({ sections: { ...secoesVazias(), activation: { answers: emptyPapAnswers(), photo: FOTO } } })], false);

    expect(el('novo-pap')).toBeNull();
    expect(el('excluir-pap-1')).toBeNull();
    expect(el('adicionar-outro-pap')).toBeNull();
    clicar('abrir-pap-1');

    expect((el('campo-local-pap') as HTMLInputElement).disabled).toBe(true);
    expect(el('foto-activation-arquivo')).toBeNull();
    clicar('voltar-a-lista');
    expect(el('paps')).not.toBeNull();
  });
});
