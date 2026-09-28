import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { TestBed } from '@angular/core/testing';
import { ActivatedRoute, provideRouter } from '@angular/router';
import { firstValueFrom } from 'rxjs';

import { API_BASE_URL } from '../../../../../../core/auth/api.config';
import { AuthService } from '../../../../../../core/auth/auth.service';
import { BRF, respostaDeLogin, sessão, vínculo } from '../../../../../../core/auth/testing/sessao';
import { rotaDaEmpresa } from '../../../../../../core/routing/testing/rota-da-empresa';
import { ActiveContextService } from '../../../../../../core/services/active-context.service';
import { detalheDeEquipamento } from '../../../../../../core/services/testing/equipamentos';
import { EquipmentContext } from './equipment-context';
import { EquipmentLayoutComponent } from './equipment.layout';

/**
 * Contexto 3 — o layout carrega a máquina que a URL nomeia pelo código, a
 * publica para as telas de dentro e para o cabeçalho, e a apaga ao sair. A
 * empresa **não** vai junto: quem volta para a lista continua dentro da planta.
 */
describe('EquipmentLayoutComponent', () => {
  const API = 'http://api.teste';
  let http: HttpTestingController;

  async function abrirEm(code: string) {
    TestBed.resetTestingModule();
    TestBed.configureTestingModule({
      providers: [
        provideRouter([]),
        provideHttpClient(),
        provideHttpClientTesting(),
        { provide: API_BASE_URL, useValue: API },
        { provide: ActivatedRoute, useValue: rotaDaEmpresa(BRF.slug, { equipmentCode: code }) },
      ],
    });
    http = TestBed.inject(HttpTestingController);

    const login = firstValueFrom(TestBed.inject(AuthService).login({ email: 'x@y.com', password: 'z' }));
    http.expectOne(`${API}/auth/login`).flush(respostaDeLogin({ session: sessão([vínculo(BRF.id, ['TECHNICIAN'])]) }));
    await login;

    const contexto = TestBed.inject(ActiveContextService);
    contexto.setCompany({ id: BRF.id, name: 'BRF' });

    const fixture = TestBed.createComponent(EquipmentLayoutComponent);
    fixture.detectChanges();
    const equipamento = fixture.debugElement.injector.get(EquipmentContext);
    return { contexto, fixture, equipamento };
  }

  afterEach(() => http.verify());

  it('deve carregar a máquina pelo código da URL e publicá-la pelo nome', async () => {
    const { contexto, equipamento, fixture } = await abrirEm('eq-0001');

    http.expectOne(`${API}/companies/${BRF.id}/equipments/eq-0001`).flush(detalheDeEquipamento());
    fixture.detectChanges();

    expect(contexto.equipment()).toEqual({ id: 'EQ-0001', name: 'Prensa excêntrica 60t' });
    expect(equipamento.atual()?.serialNumber).toBe('SN-1234');
  });

  it('deve dizer que a máquina não existe, em vez de inventar um nome', async () => {
    const { contexto, fixture } = await abrirEm('eq-9999');

    http
      .expectOne(`${API}/companies/${BRF.id}/equipments/eq-9999`)
      .flush(null, { status: 404, statusText: 'Not Found' });
    fixture.detectChanges();

    expect(contexto.equipment()).toBeNull();
    expect(fixture.nativeElement.querySelector('[data-testid="equipamento-inexistente"]')).not.toBeNull();
  });

  it('deve apagar a máquina ao sair, e só ela', async () => {
    const { contexto, fixture } = await abrirEm('eq-0001');
    http.expectOne(`${API}/companies/${BRF.id}/equipments/eq-0001`).flush(detalheDeEquipamento());

    fixture.destroy();

    expect(contexto.equipment()).toBeNull();
    expect(contexto.company()?.name).toBe('BRF');
  });
});
