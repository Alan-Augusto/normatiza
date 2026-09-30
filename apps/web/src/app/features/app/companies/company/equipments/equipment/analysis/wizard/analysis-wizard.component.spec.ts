import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { Component } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { Router, provideRouter } from '@angular/router';
import { RouterTestingHarness } from '@angular/router/testing';
import { firstValueFrom } from 'rxjs';

import type { AnalysisDetail } from '@normatiza/shared';

import { API_BASE_URL } from '../../../../../../../../core/auth/api.config';
import { AuthService } from '../../../../../../../../core/auth/auth.service';
import { BRF, respostaDeLogin, sessão, vínculo } from '../../../../../../../../core/auth/testing/sessao';
import { CARLA, FERNANDO, SÓ_LEITURA, detalheDeAnalise } from '../../../../../../../../core/services/testing/analises';
import { detalheDeEquipamento } from '../../../../../../../../core/services/testing/equipamentos';
import { EquipmentContext } from '../../equipment-context';
import { AnalysisWizardComponent } from './analysis-wizard.component';

@Component({ standalone: true, template: '' })
class Destino {}

/**
 * O assistente da análise, etapa 1 ([03 §5.2](../../../../../../../../../../docs/produto/03_navegacao_e_telas.md)):
 * nada é obrigatório para salvar, as fotos sobem na hora, e o rascunho se descarta.
 */
describe('AnalysisWizardComponent', () => {
  const API = 'http://api.teste';
  const ANALISE = `${API}/companies/${BRF.id}/equipments/EQ-0001/analyses/1`;
  const TECNICOS = `${API}/companies/${BRF.id}/equipments/EQ-0001/analyses/field-technicians`;
  const TELA = `/app/empresas/${BRF.slug}/equipamentos/eq-0001/analise/1`;
  let http: HttpTestingController;
  let harness: RouterTestingHarness;

  beforeEach(() => {
    TestBed.configureTestingModule({
      providers: [
        provideRouter([
          { path: 'app/empresas/:companySlug/equipamentos/:equipmentCode/analise/:numero', component: AnalysisWizardComponent },
          { path: 'app/empresas/:companySlug/equipamentos/:equipmentCode/analise', component: Destino },
          { path: 'app/empresas/:companySlug/equipamentos/:equipmentCode/editar', component: Destino },
        ]),
        provideHttpClient(),
        provideHttpClientTesting(),
        { provide: API_BASE_URL, useValue: API },
        EquipmentContext,
      ],
    });
    http = TestBed.inject(HttpTestingController);
    TestBed.inject(EquipmentContext).atual.set(detalheDeEquipamento());
  });

  afterEach(() => http.verify());

  async function abrir(analise: AnalysisDetail = detalheDeAnalise()) {
    const login = firstValueFrom(TestBed.inject(AuthService).login({ email: 'q@s.com', password: 'c' }));
    http.expectOne(`${API}/auth/login`).flush(respostaDeLogin({ session: sessão([vínculo(BRF.id, ['TECHNICIAN'])]) }));
    await login;
    harness = await RouterTestingHarness.create();
    await harness.navigateByUrl(TELA, AnalysisWizardComponent);
    http.expectOne(ANALISE).flush(analise);
    if (analise.actions.edit) http.expectOne(TECNICOS).flush([CARLA, FERNANDO]);
    await harness.fixture.whenStable();
    harness.detectChanges();
  }

  const raiz = () => harness.routeNativeElement as HTMLElement;
  const el = (testid: string) => raiz().querySelector<HTMLElement>(`[data-testid="${testid}"]`);
  const entrada = (testid: string) => {
    const alvo = el(testid);
    return (alvo?.matches('input') ? alvo : alvo?.querySelector('input')) as HTMLInputElement;
  };
  function digitar(testid: string, valor: string) {
    const campo = entrada(testid);
    campo.value = valor;
    campo.dispatchEvent(new Event('input'));
    campo.dispatchEvent(new Event('blur'));
    harness.detectChanges();
  }
  function clicar(testid: string) {
    const alvo = el(testid)?.matches('button, a') ? el(testid) : el(testid)?.querySelector<HTMLElement>('button');
    if (!alvo) throw new Error(`"${testid}" não está na tela.`);
    alvo.click();
    harness.detectChanges();
  }
  /** O botão "Sim" ou "Não" de uma pergunta da gestão de segurança. */
  function responder(pergunta: string, resposta: 'Sim' | 'Não') {
    const botões = [...el(`pergunta-${pergunta}`)!.querySelectorAll<HTMLElement>('[role="button"]')];
    botões.find((b) => b.textContent?.trim() === resposta)!.click();
    harness.detectChanges();
  }
  function escolherFoto(vista: string, arquivo: File) {
    const campo = entrada(`foto-arquivo-${vista}`);
    Object.defineProperty(campo, 'files', { value: [arquivo], configurable: true });
    campo.dispatchEvent(new Event('change'));
    harness.detectChanges();
  }
  const componente = () => harness.routeDebugElement!.componentInstance as AnalysisWizardComponent;

  it('deve abrir com o que o rascunho já tem', async () => {
    await abrir(
      detalheDeAnalise({
        sheet: {
          times: { cycleTimeSec: 12.5 },
          shiftRegime: '2 turnos',
          safetyManagement: { ...detalheDeAnalise().sheet.safetyManagement, hasInstructionManual: true },
        },
      }),
    );

    expect(el('titulo')?.textContent).toContain('EQ-0001 · Análise 1');
    expect(entrada('campo-ciclo').value).toBe('12,5');
    expect(entrada('campo-regime').value).toBe('2 turnos');
    expect(componente().form.controls.hasInstructionManual.value).toBe(true);
    expect(el('fotos-faltando')?.textContent).toContain('Faltam 4');
  });

  it('deve salvar a etapa 1 inteira, com as perguntas sem resposta como nulas', async () => {
    await abrir();

    digitar('campo-parada', '0,8');
    digitar('campo-regime', '3 turnos');
    responder('workersTrained', 'Não');
    clicar('salvar');

    const req = http.expectOne(`${ANALISE}/sheet`);
    expect(req.request.method).toBe('PUT');
    expect(req.request.body).toEqual({
      fieldTechnicianUserId: FERNANDO.id,
      times: { cycleTimeSec: undefined, activationTimeSec: undefined, emergencyStopTimeSec: 0.8 },
      shiftRegime: '3 turnos',
      safetyManagement: {
        maintenancePlannedByQualifiedProfessional: null,
        maintenanceRecorded: null,
        maintenanceRecordsAvailable: null,
        hasInstructionManual: null,
        hasWorkAndSafetyProcedures: null,
        workersTrained: false,
      },
    });
    req.flush(detalheDeAnalise({ sheet: { times: { emergencyStopTimeSec: 0.8 }, shiftRegime: '3 turnos', safetyManagement: req.request.body.safetyManagement } }));
    harness.detectChanges();

    expect(el('aviso')?.textContent).toContain('Rascunho salvo');
    expect(componente().temAlteracoesNaoSalvas()).toBe(false);
  });

  it('deve avisar que há alteração por salvar antes de sair', async () => {
    await abrir();

    digitar('campo-regime', '1 turno');

    expect(componente().temAlteracoesNaoSalvas()).toBe(true);
  });

  it('deve enviar a foto assim que escolhida, e mostrar a miniatura', async () => {
    await abrir();

    escolherFoto('front', new File(['x'], 'frente.jpg', { type: 'image/jpeg' }));
    const req = http.expectOne(`${ANALISE}/photos/front`);
    expect(req.request.method).toBe('PUT');
    expect(req.request.body).toBeInstanceOf(FormData);
    req.flush({ url: 'http://arquivos/frente', thumbnailUrl: 'http://arquivos/frente-thumb' });
    harness.detectChanges();

    expect(el('vista-front')?.querySelector('img')?.getAttribute('src')).toBe('http://arquivos/frente-thumb');
    expect(el('fotos-faltando')?.textContent).toContain('Faltam 3');
  });

  it('deve recusar, sem enviar, o arquivo que não é imagem', async () => {
    await abrir();

    escolherFoto('rear', new File(['%PDF'], 'laudo.pdf', { type: 'application/pdf' }));

    expect(el('foto-erro')?.textContent).toContain('PNG, JPG ou WebP');
  });

  it('deve descartar o rascunho, depois de confirmar, e voltar à lista', async () => {
    await abrir();

    clicar('descartar');
    (document.querySelector('[data-testid="confirmar-descarte"] button') as HTMLElement).click();
    const req = http.expectOne(ANALISE);
    expect(req.request.method).toBe('DELETE');
    req.flush(null);
    await harness.fixture.whenStable();

    expect(TestBed.inject(Router).url).toBe(`/app/empresas/${BRF.slug}/equipamentos/eq-0001/analise`);
  });

  it('deve levar a correção da ficha ao cadastro do equipamento, com a volta para cá', async () => {
    await abrir();

    const link = el('corrigir-ficha')!;

    expect(link.getAttribute('href')).toBe(
      `/app/empresas/${BRF.slug}/equipamentos/eq-0001/editar?voltar=${encodeURIComponent(TELA)}`,
    );
  });

  it('deve anunciar as etapas que ainda não existem, sem esconder o caminho', async () => {
    await abrir();

    clicar('passo-pontos');

    expect(el('etapa-futura')?.textContent).toContain('Pontos de risco chega na próxima entrega');
  });

  it('deve abrir só para leitura a análise que não se edita', async () => {
    await abrir(detalheDeAnalise({ status: 'CONCLUDED', actions: SÓ_LEITURA }));

    expect(el('salvar')).toBeNull();
    expect(el('descartar')).toBeNull();
    expect(el('corrigir-ficha')).toBeNull();
    expect(entrada('campo-regime').disabled).toBe(true);
  });
});
