import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { Component } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { Router, provideRouter } from '@angular/router';
import { RouterTestingHarness } from '@angular/router/testing';
import { firstValueFrom } from 'rxjs';

import type { MembershipWithCompany } from '@normatiza/shared';

import { API_BASE_URL } from '../../../../../../../core/auth/api.config';
import { AuthService } from '../../../../../../../core/auth/auth.service';
import { BRF, respostaDeLogin, sessão, vínculo } from '../../../../../../../core/auth/testing/sessao';
import { linhaDeAnalise, detalheDeAnalise, SÓ_LEITURA } from '../../../../../../../core/services/testing/analises';
import { detalheDeEquipamento } from '../../../../../../../core/services/testing/equipamentos';
import { EquipmentContext } from '../equipment-context';
import { EquipmentAnalysisComponent } from './analysis.component';

@Component({ standalone: true, template: '' })
class Destino {}

/**
 * As análises da máquina ([03 §5.2](../../../../../../../../../docs/produto/03_navegacao_e_telas.md)):
 * um rascunho por máquina, e o rascunho é da consultoria.
 */
describe('EquipmentAnalysisComponent', () => {
  const API = 'http://api.teste';
  const ANALISES = `${API}/companies/${BRF.id}/equipments/EQ-0001/analyses`;
  const LISTA = `/app/empresas/${BRF.slug}/equipamentos/eq-0001/analise`;
  let http: HttpTestingController;
  let harness: RouterTestingHarness;

  beforeEach(() => {
    TestBed.configureTestingModule({
      providers: [
        provideRouter([
          { path: 'app/empresas/:companySlug/equipamentos/:equipmentCode/analise', component: EquipmentAnalysisComponent },
          { path: 'app/empresas/:companySlug/equipamentos/:equipmentCode/analise/:numero', component: Destino },
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

  async function abrirComo(memberships: MembershipWithCompany[], lista = [] as ReturnType<typeof linhaDeAnalise>[]) {
    const login = firstValueFrom(TestBed.inject(AuthService).login({ email: 'q@s.com', password: 'c' }));
    http.expectOne(`${API}/auth/login`).flush(respostaDeLogin({ session: sessão(memberships) }));
    await login;
    harness = await RouterTestingHarness.create();
    await harness.navigateByUrl(LISTA, EquipmentAnalysisComponent);
    http.expectOne(ANALISES).flush(lista);
    harness.detectChanges();
  }

  const raiz = () => harness.routeNativeElement as HTMLElement;
  const el = (testid: string) => raiz().querySelector<HTMLElement>(`[data-testid="${testid}"]`);
  function clicar(testid: string) {
    const alvo = el(testid)?.matches('button, a') ? el(testid) : el(testid)?.querySelector<HTMLElement>('button');
    if (!alvo) throw new Error(`"${testid}" não está na tela.`);
    alvo.click();
    harness.detectChanges();
  }
  const comoFernando = () => abrirComo([vínculo(BRF.id, ['TECHNICIAN'])]);

  it('deve oferecer à consultoria abrir a primeira análise, e levar direto para ela', async () => {
    await comoFernando();
    expect(raiz().textContent).toContain('ainda não tem análise');

    clicar('nova-analise');
    const req = http.expectOne(ANALISES);
    expect(req.request.method).toBe('POST');
    req.flush(detalheDeAnalise());
    await harness.fixture.whenStable();

    expect(TestBed.inject(Router).url).toBe(`${LISTA}/1`);
  });

  it('deve trocar "nova análise" por "continuar" enquanto houver rascunho aberto', async () => {
    await abrirComo([vínculo(BRF.id, ['TECHNICIAN'])], [linhaDeAnalise({ number: 2 }), linhaDeAnalise({ id: 'an-0', number: 1, status: 'CONCLUDED', actions: SÓ_LEITURA })]);

    expect(el('nova-analise')).toBeNull();
    expect(el('continuar')?.textContent).toContain('Continuar a Análise 2');
    expect(el('continuar')?.getAttribute('href')).toBe(`${LISTA}/2`);
  });

  it('deve mostrar o técnico, quantos pontos a análise tem e o pior HRN, com o nome da faixa', async () => {
    await abrirComo([vínculo(BRF.id, ['TECHNICIAN'])], [linhaDeAnalise({ riskPointsCount: 3, worstHrn: { result: 120, level: 'VERY_HIGH' } })]);

    const linha = el('analise-1')!;
    expect(linha.textContent).toContain('Fernando');
    expect(linha.textContent).toContain('Rascunho');
    expect(linha.querySelector('[data-testid="pontos"]')?.textContent?.trim()).toBe('3');
    expect(linha.querySelector('[data-testid="hrn"]')?.textContent?.replace(/\s+/g, ' ').trim()).toBe('120 Risco Muito Alto');
  });

  it('deve mostrar "—" no pior HRN enquanto nenhum ponto tem HRN', async () => {
    await abrirComo([vínculo(BRF.id, ['TECHNICIAN'])], [linhaDeAnalise()]);

    expect(el('analise-1')!.querySelector('[data-testid="hrn"]')?.textContent?.trim()).toBe('—');
  });

  it('não deve mostrar conclusão nem engenheiro enquanto nenhuma análise tem esses dados', async () => {
    await abrirComo([vínculo(BRF.id, ['TECHNICIAN'])], [linhaDeAnalise()]);

    expect(raiz().textContent).not.toContain('Engenheiro responsável');
    expect(raiz().textContent).not.toContain('Conclusão');
  });

  it('não deve oferecer abrir análise ao cliente, e deve dizer quando ela aparece', async () => {
    await abrirComo([vínculo(BRF.id, ['MANAGER'])]);

    expect(el('nova-analise')).toBeNull();
    expect(raiz().textContent).toContain('quando a consultoria as conclui');
  });

  it('deve dizer qual rascunho outro técnico já abriu, e atualizar a lista', async () => {
    await comoFernando();

    clicar('nova-analise');
    http
      .expectOne(ANALISES)
      .flush(
        { statusCode: 409, number: 1, message: 'A Análise 1 desta máquina ainda é rascunho. Conclua ou descarte antes de abrir outra.' },
        { status: 409, statusText: 'Conflict' },
      );
    http.expectOne(ANALISES).flush([linhaDeAnalise({ fieldTechnician: { id: 'user-carla', name: 'Carla' } })]);
    harness.detectChanges();

    expect(el('erro')?.textContent).toContain('A Análise 1 desta máquina ainda é rascunho');
    expect(el('continuar')).not.toBeNull();
  });
});
