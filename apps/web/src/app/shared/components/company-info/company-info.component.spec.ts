import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { ComponentFixture, TestBed } from '@angular/core/testing';
import { provideRouter } from '@angular/router';

import type { CompanyView } from '@normatiza/shared';

import { API_BASE_URL } from '../../../core/auth/api.config';
import { BRF } from '../../../core/auth/testing/sessao';
import { detalheDaBrf, perfilDaBrf } from '../../../core/services/testing/empresas';
import { CompanyInfoComponent } from './company-info.component';

/**
 * Os dados da empresa, abertos pelo nome dela na sidebar
 * ([03 §4.0](../../../../../../../docs/produto/03_navegacao_e_telas.md)).
 *
 * Texto, não formulário. E o recorte do cliente é do servidor: a tela mostra o
 * que chegou — o teste confere que ela não inventa um "Editar" para quem recebeu
 * a projeção do cliente.
 */
describe('CompanyInfoComponent', () => {
  let fixture: ComponentFixture<CompanyInfoComponent>;
  let http: HttpTestingController;

  const API = 'http://api.teste';

  beforeEach(() => {
    TestBed.configureTestingModule({
      imports: [CompanyInfoComponent],
      providers: [
        provideRouter([]),
        provideHttpClient(),
        provideHttpClientTesting(),
        { provide: API_BASE_URL, useValue: API },
      ],
    });
    http = TestBed.inject(HttpTestingController);
  });

  afterEach(() => http.verify());

  function abrir(resposta: CompanyView) {
    fixture = TestBed.createComponent(CompanyInfoComponent);
    fixture.componentRef.setInput('companyId', BRF.id);
    fixture.detectChanges();
    http.expectOne(`${API}/companies/${BRF.id}`).flush(resposta);
    fixture.detectChanges();
  }

  const texto = () => (fixture.nativeElement as HTMLElement).textContent ?? '';
  const el = (s: string) => (fixture.nativeElement as HTMLElement).querySelector(s);

  it('deve mostrar ao cliente os dados principais, formatados', () => {
    abrir(perfilDaBrf());

    expect(texto()).toContain('BRF S.A.');
    expect(texto()).toContain('22.222.222/0001-91');
    expect(texto()).toContain('Rua Senador Atílio Fontana, 86');
    expect(texto()).toContain('Concórdia/SC');
    expect(texto()).toContain('89700-000');
    expect(texto()).toContain('Marcos');
  });

  it('deve nomear quem presta o serviço e quem assina', () => {
    abrir(perfilDaBrf());

    expect(texto()).toContain('Normatiza');
    expect(texto()).toContain('Carla');
    expect(texto()).toContain('CREA-SP 111111');
  });

  it('não deve ter campo de formulário nenhum', () => {
    abrir(detalheDaBrf());

    expect(el('input, textarea, select')).toBeNull();
  });

  it('não deve oferecer Editar nem mostrar anotações da consultoria ao cliente', () => {
    abrir(perfilDaBrf());

    expect(el('[data-testid="editar-empresa"]')).toBeNull();
    expect(texto()).not.toContain('Observações');
  });

  it('deve mostrar à consultoria o grupo, o código e as observações, e levar à edição', () => {
    abrir(detalheDaBrf());

    expect(texto()).toContain('Grupo BRF');
    expect(texto()).toContain('CLI-0001');
    expect(texto()).toContain('Visitas técnicas só às terças.');
    expect(el('[data-testid="editar-empresa"] a')?.getAttribute('href')).toBe(`/app/empresas/${BRF.id}/editar`);
  });

  it('não deve oferecer Editar à consultoria sem alçada — o Técnico', () => {
    abrir(detalheDaBrf({ actions: { edit: false, deactivate: false, reactivate: false, inviteManager: false } }));

    expect(el('[data-testid="editar-empresa"]')).toBeNull();
  });
});
