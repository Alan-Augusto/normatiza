import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { TestBed } from '@angular/core/testing';
import { ActivatedRoute, convertToParamMap, provideRouter } from '@angular/router';
import { firstValueFrom, of } from 'rxjs';

import { API_BASE_URL } from '../../../../core/auth/api.config';
import { AuthService } from '../../../../core/auth/auth.service';
import { BRF, respostaDeLogin, sessão, vínculo } from '../../../../core/auth/testing/sessao';
import { ActiveContextService } from '../../../../core/services/active-context.service';
import { CompanyLayoutComponent } from './company.layout';

/**
 * O layout do Contexto 2 publica **quem** está em contexto, e é dessa publicação
 * que vivem as duas coisas que dizem à pessoa onde ela está: o cabeçalho acima do
 * título e a migalha.
 *
 * O defeito que este teste tranca: o layout publicava `Empresa ${id}`, e as duas
 * mostravam o `cuid` da empresa — um identificador de banco na cara de quem usa.
 */
describe('CompanyLayoutComponent', () => {
  let http: HttpTestingController;

  const API = 'http://api.teste';

  async function abrirEm(companyId: string) {
    TestBed.resetTestingModule();
    TestBed.configureTestingModule({
      providers: [
        provideRouter([]),
        provideHttpClient(),
        provideHttpClientTesting(),
        { provide: API_BASE_URL, useValue: API },
        {
          provide: ActivatedRoute,
          useValue: { paramMap: of(convertToParamMap({ companyId })) },
        },
      ],
    });

    http = TestBed.inject(HttpTestingController);
    const auth = TestBed.inject(AuthService);

    const promessa = firstValueFrom(auth.login({ email: 'x@y.com', password: 'z' }));
    http
      .expectOne(`${API}/auth/login`)
      .flush(respostaDeLogin({ session: sessão([vínculo(BRF.id, ['MANAGER'])]) }));
    await promessa;

    const fixture = TestBed.createComponent(CompanyLayoutComponent);
    fixture.detectChanges();

    return { contexto: TestBed.inject(ActiveContextService), fixture };
  }

  afterEach(() => http.verify());

  it('deve publicar a empresa pelo nome, não pelo id', async () => {
    const { contexto } = await abrirEm(BRF.id);

    expect(contexto.company()?.name).toBe(BRF.tradeName);
    expect(contexto.company()?.name).not.toContain(BRF.id);
  });

  it('deve cair no id quando a empresa não está no escopo de quem olha', async () => {
    // A guarda de rota já impede chegar aqui sem vínculo. Se chegar, o id é a
    // resposta honesta: inventar um nome seria pior do que mostrar um feio.
    const { contexto } = await abrirEm('company-que-nao-e-minha');

    expect(contexto.company()?.name).toBe('company-que-nao-e-minha');
  });

  it('deve apagar o contexto ao sair da empresa', async () => {
    // O defeito: o layout publicava ao entrar e nunca limpava ao sair. Quem
    // voltasse para a carteira continuava lendo "BRF" na sidebar, numa tela
    // que não é de empresa nenhuma.
    const { contexto, fixture } = await abrirEm(BRF.id);
    expect(contexto.company()).not.toBeNull();

    fixture.destroy();

    expect(contexto.company()).toBeNull();
  });

  it('deve levar o equipamento junto ao sair da empresa', async () => {
    // Não existe máquina sem a planta dela: sair da BRF apaga as duas linhas.
    const { contexto, fixture } = await abrirEm(BRF.id);
    contexto.setEquipment({ id: 'eq-injetora', name: 'Injetora de plástico' });

    fixture.destroy();

    expect(contexto.equipment()).toBeNull();
  });
});
