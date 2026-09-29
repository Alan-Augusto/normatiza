import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { TestBed } from '@angular/core/testing';
import { provideRouter } from '@angular/router';
import { firstValueFrom } from 'rxjs';

import type { EquipmentDetail } from '@normatiza/shared';

import { API_BASE_URL } from '../../../../../../../core/auth/api.config';
import { AuthService } from '../../../../../../../core/auth/auth.service';
import { BRF, respostaDeLogin, sessão, vínculo } from '../../../../../../../core/auth/testing/sessao';
import { rotaDaEmpresa } from '../../../../../../../core/routing/testing/rota-da-empresa';
import { SÓ_LÊ, detalheDeEquipamento } from '../../../../../../../core/services/testing/equipamentos';
import { ActivatedRoute } from '@angular/router';
import { EquipmentContext } from '../equipment-context';
import { EquipmentDashboardComponent } from './dashboard.component';

/**
 * A radiografia da máquina ([03 §5.1](../../../../../../../../../docs/produto/03_navegacao_e_telas.md)):
 * a identificação vem do cadastro, e o que é da análise diz "—" até haver análise.
 */
describe('EquipmentDashboardComponent', () => {
  const API = 'http://api.teste';

  async function abrir(equipamento: EquipmentDetail) {
    TestBed.resetTestingModule();
    TestBed.configureTestingModule({
      providers: [
        provideRouter([]),
        provideHttpClient(),
        provideHttpClientTesting(),
        { provide: API_BASE_URL, useValue: API },
        EquipmentContext,
        { provide: ActivatedRoute, useValue: rotaDaEmpresa(BRF.slug, { equipmentCode: 'eq-0001' }) },
      ],
    });
    const login = firstValueFrom(TestBed.inject(AuthService).login({ email: 'q@s.com', password: 'c' }));
    TestBed.inject(HttpTestingController)
      .expectOne(`${API}/auth/login`)
      .flush(respostaDeLogin({ session: sessão([vínculo(BRF.id, ['TECHNICIAN'])]) }));
    await login;

    const contexto = TestBed.inject(EquipmentContext);
    contexto.atual.set(equipamento);
    contexto.carregando.set(false);
    const fixture = TestBed.createComponent(EquipmentDashboardComponent);
    fixture.detectChanges();
    return fixture.nativeElement as HTMLElement;
  }

  it('deve mostrar a identificação do cadastro', async () => {
    const tela = await abrir(detalheDeEquipamento());

    for (const trecho of ['EQ-0001', 'Prensa excêntrica', 'PE-60', 'Metalúrgica Sul', 'SN-1234', '2012', 'PR-01', 'PAT-77', 'Estamparia']) {
      expect(tela.textContent).toContain(trecho);
    }
  });

  it('deve mostrar a ficha do ativo: operação, energia, dimensões e fabricante', async () => {
    const tela = await abrir(detalheDeEquipamento());

    for (const trecho of ['Estampagem de chapas', '30 golpes/min', '7,5 kW', 'Elétrica · Pneumática', '2400 mm', '4200 kg', '11.222.333/0001-81', 'Joinville']) {
      expect(tela.textContent).toContain(trecho);
    }
  });

  it('deve dizer que a ficha está vazia, em vez de uma parede de "—", para a máquina cadastrada só com o nome', async () => {
    const tela = await abrir(detalheDeEquipamento({ sheet: { energySources: [], dimensions: {}, manufacturer: {} } }));

    expect(tela.querySelector('[data-testid="ficha-vazia"]')).not.toBeNull();
  });

  it('deve mostrar "—" nos indicadores que são da análise, e dizer que ainda não houve análise', async () => {
    const tela = await abrir(detalheDeEquipamento());

    expect(tela.querySelector('[data-testid="pior-hrn"]')?.textContent?.trim()).toBe('—');
    expect(tela.querySelector('[data-testid="ultima-analise"]')?.textContent?.trim()).toBe('—');
    expect(tela.querySelector('[data-testid="conformidade"]')?.textContent).toContain('Sem análise');
  });

  it('deve mostrar "—" no que o cadastro não tem, em vez de campo em branco', async () => {
    const tela = await abrir(detalheDeEquipamento({ serialNumber: undefined }));

    expect(tela.querySelector('[data-testid="identidade-serie"]')?.textContent?.trim()).toBe('—');
  });

  it('deve oferecer a edição só a quem edita', async () => {
    expect((await abrir(detalheDeEquipamento())).querySelector('[data-testid="editar"]')?.getAttribute('href')).toBe(
      `/app/empresas/${BRF.slug}/equipamentos/eq-0001/editar`,
    );
    expect((await abrir(detalheDeEquipamento({ actions: SÓ_LÊ }))).querySelector('[data-testid="editar"]')).toBeNull();
  });

  it('deve mostrar a foto quando há foto', async () => {
    const tela = await abrir(detalheDeEquipamento({ photoUrl: 'https://arquivos.teste/eq1.jpg' }));

    expect(tela.querySelector('[data-testid="foto"]')?.getAttribute('src')).toBe('https://arquivos.teste/eq1.jpg');
  });
});
