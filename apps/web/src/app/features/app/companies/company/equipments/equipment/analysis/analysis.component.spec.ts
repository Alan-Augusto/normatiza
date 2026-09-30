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

  const el = (testid: string) => (harness.routeNativeElement as HTMLElement).querySelector<HTMLElement>(`[data-testid="${testid}"]`);
  const comoFernando = () => abrirComo([vínculo(BRF.id, ['TECHNICIAN'])]);

  it('deve oferecer à consultoria abrir a primeira análise, e levar direto para ela', async () => {
    await comoFernando();
    expect(el('vazio')?.textContent).toContain('ainda não tem análise');

    el('nova-analise')!.click();
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

  it('deve mostrar o técnico, e "—" nos números de risco, que chegam com os pontos', async () => {
    await abrirComo([vínculo(BRF.id, ['TECHNICIAN'])], [linhaDeAnalise()]);

    const linha = el('analise-1')!;
    expect(linha.textContent).toContain('Fernando');
    expect(linha.textContent).toContain('Rascunho');
    expect([...linha.querySelectorAll('td')].map((td) => td.textContent?.trim()).slice(5, 7)).toEqual(['—', '—']);
  });

  it('não deve oferecer abrir análise ao cliente, e deve dizer quando ela aparece', async () => {
    await abrirComo([vínculo(BRF.id, ['MANAGER'])]);

    expect(el('nova-analise')).toBeNull();
    expect(el('vazio')?.textContent).toContain('quando a consultoria as conclui');
  });

  it('deve dizer qual rascunho outro técnico já abriu, e atualizar a lista', async () => {
    await comoFernando();

    el('nova-analise')!.click();
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
