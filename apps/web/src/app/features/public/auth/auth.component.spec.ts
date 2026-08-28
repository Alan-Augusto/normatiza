import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { ComponentFixture, TestBed } from '@angular/core/testing';
import { ActivatedRoute, Router, provideRouter } from '@angular/router';
import { of } from 'rxjs';
import { vi } from 'vitest';

import { API_BASE_URL } from '../../../core/auth/api.config';
import { BRF, respostaDeLogin, sessão, vínculo } from '../../../core/auth/testing/sessao';
import { AuthComponent } from './auth.component';

/**
 * A tela de login. O que se verifica aqui é o que a pessoa vê e pode fazer —
 * não como o serviço por trás está escrito.
 */
describe('AuthComponent', () => {
  let fixture: ComponentFixture<AuthComponent>;
  let http: HttpTestingController;
  let navegou: string[];
  let queryParams: Record<string, string>;

  const API = 'http://api.teste';

  beforeEach(async () => {
    navegou = [];
    queryParams = {};

    await TestBed.configureTestingModule({
      imports: [AuthComponent],
      providers: [
        provideRouter([]),
        provideHttpClient(),
        provideHttpClientTesting(),
        { provide: API_BASE_URL, useValue: API },
        {
          provide: ActivatedRoute,
          useValue: { snapshot: { queryParams: {} }, queryParams: of(queryParams) },
        },
      ],
    }).compileComponents();

    // O router é real (a tela tem `routerLink`); só o destino é observado.
    vi.spyOn(TestBed.inject(Router), 'navigateByUrl').mockImplementation((url) => {
      navegou.push(String(url));
      return Promise.resolve(true);
    });

    fixture = TestBed.createComponent(AuthComponent);
    http = TestBed.inject(HttpTestingController);
    fixture.detectChanges();
  });

  afterEach(() => http.verify());

  const el = (seletor: string) => fixture.nativeElement.querySelector(seletor) as HTMLElement | null;
  const texto = () => (fixture.nativeElement as HTMLElement).textContent ?? '';

  function preencher(email: string, senha: string) {
    const campoEmail = el('[data-testid="email"]') as HTMLInputElement;
    const campoSenha = el('[data-testid="password"]') as HTMLInputElement;
    campoEmail.value = email;
    campoEmail.dispatchEvent(new Event('input'));
    campoSenha.value = senha;
    campoSenha.dispatchEvent(new Event('input'));
    fixture.detectChanges();
  }

  function enviar() {
    (el('form') as HTMLFormElement).dispatchEvent(new Event('submit'));
    fixture.detectChanges();
  }

  describe('o formulário', () => {
    it('deve oferecer e-mail, senha e envio', () => {
      expect(el('[data-testid="email"]')).not.toBeNull();
      expect(el('[data-testid="password"]')).not.toBeNull();
      expect(el('[data-testid="submit"]')).not.toBeNull();
    });

    it('deve esconder o que é digitado no campo de senha', () => {
      expect((el('[data-testid="password"]') as HTMLInputElement).type).toBe('password');
    });

    it('não deve enviar formulário vazio', () => {
      enviar();
      http.expectNone(`${API}/auth/login`);
    });

    it('deve aceitar e-mail colado com espaço em volta', () => {
      // `Validators.email` é ancorado: `" a@b.com "` reprova, o `submit` volta
      // sem fazer nada e o botão fica mudo. Aparar só na hora de enviar não
      // resolve — a validação já aconteceu.
      preencher('  marcos@brf.com  ', 'a-senha');
      enviar();

      const req = http.expectOne(`${API}/auth/login`);
      expect(req.request.body.email).toBe('marcos@brf.com');
      req.flush(respostaDeLogin());
    });

    it('não deve aparar a senha, nem quando ela tem espaço nas pontas', () => {
      // Espaço é caractere legítimo de senha. Cortá-lo em silêncio recusaria
      // quem escolheu usar um — e a recusa seria "senha inválida", sem pista.
      preencher('marcos@brf.com', '  com espaco  ');
      enviar();

      const req = http.expectOne(`${API}/auth/login`);
      expect(req.request.body.password).toBe('  com espaco  ');
      req.flush(respostaDeLogin());
    });

    it('deve oferecer o caminho de quem esqueceu a senha', () => {
      expect(el('[data-testid="forgot-password"]')).not.toBeNull();
    });
  });

  describe('durante o envio', () => {
    it('deve desabilitar o botão enquanto a API não responde', () => {
      // Sem isto, o duplo clique impaciente vira duas tentativas — e duas
      // tentativas contam duas vezes no rate limit da API.
      preencher('marcos@brf.com', 'certa');
      enviar();

      expect((el('[data-testid="submit"]') as HTMLButtonElement).disabled).toBe(true);

      http.expectOne(`${API}/auth/login`).flush(respostaDeLogin());
      fixture.detectChanges();
    });

    it('deve reabilitar o botão quando a tentativa falha', () => {
      preencher('marcos@brf.com', 'errada');
      enviar();

      http
        .expectOne(`${API}/auth/login`)
        .flush({ message: 'E-mail ou senha inválidos.' }, { status: 401, statusText: 'Unauthorized' });
      fixture.detectChanges();

      expect((el('[data-testid="submit"]') as HTMLButtonElement).disabled).toBe(false);
    });
  });

  describe('quando a credencial é recusada', () => {
    it('deve mostrar o erro na tela', () => {
      preencher('marcos@brf.com', 'errada');
      enviar();

      http
        .expectOne(`${API}/auth/login`)
        .flush({ message: 'E-mail ou senha inválidos.' }, { status: 401, statusText: 'Unauthorized' });
      fixture.detectChanges();

      expect(el('[data-testid="erro"]')).not.toBeNull();
      expect(texto()).toContain('E-mail ou senha inválidos.');
    });

    it('não deve dizer qual dos dois estava errado', () => {
      // A mensagem é a mesma que a API devolve, e ela é única de propósito:
      // "esse e-mail não existe" seria confirmar quem é cliente de quem.
      preencher('ninguem@lugar.com', 'chute');
      enviar();

      http
        .expectOne(`${API}/auth/login`)
        .flush({ message: 'E-mail ou senha inválidos.' }, { status: 401, statusText: 'Unauthorized' });
      fixture.detectChanges();

      expect(texto()).not.toContain('não encontrado');
      expect(texto()).not.toContain('não existe');
    });

    it('deve avisar quando a API está fora do ar, em vez de ficar em silêncio', () => {
      preencher('marcos@brf.com', 'certa');
      enviar();

      http
        .expectOne(`${API}/auth/login`)
        .flush(null, { status: 500, statusText: 'Server Error' });
      fixture.detectChanges();

      expect(el('[data-testid="erro"]')).not.toBeNull();
    });

    it('deve limpar o erro anterior numa nova tentativa', () => {
      preencher('marcos@brf.com', 'errada');
      enviar();
      http
        .expectOne(`${API}/auth/login`)
        .flush({ message: 'E-mail ou senha inválidos.' }, { status: 401, statusText: 'Unauthorized' });
      fixture.detectChanges();

      preencher('marcos@brf.com', 'certa');
      enviar();
      expect(el('[data-testid="erro"]')).toBeNull();

      http.expectOne(`${API}/auth/login`).flush(respostaDeLogin());
      fixture.detectChanges();
    });
  });

  describe('quando entra', () => {
    it('deve levar o Gestor direto para a empresa dele', async () => {
      preencher('marcos@brf.com', 'certa');
      enviar();

      http
        .expectOne(`${API}/auth/login`)
        .flush(respostaDeLogin({ session: sessão([vínculo(BRF.id, ['MANAGER'])]) }));
      await fixture.whenStable();

      expect(navegou).toContain(`/app/companies/${BRF.id}/dashboard`);
    });

    it('deve levar a consultoria para o Contexto 1', async () => {
      preencher('josue@normatiza.com', 'certa');
      enviar();

      http
        .expectOne(`${API}/auth/login`)
        .flush(respostaDeLogin({ session: sessão([vínculo(BRF.id, ['LEAD_ENGINEER'])]) }));
      await fixture.whenStable();

      expect(navegou).toContain('/app/dashboard');
    });

    it('deve voltar para onde a pessoa tentava ir antes de ser barrada', async () => {
      // O `returnUrl` é posto pelo authGuard. Ignorá-lo aqui faria a guarda
      // guardar um endereço que ninguém usa.
      queryParams['returnUrl'] = '/app/companies/brf/equipments/xyz';
      fixture = TestBed.createComponent(AuthComponent);
      fixture.detectChanges();

      preencher('marcos@brf.com', 'certa');
      enviar();

      http.expectOne(`${API}/auth/login`).flush(respostaDeLogin());
      await fixture.whenStable();

      expect(navegou).toContain('/app/companies/brf/equipments/xyz');
    });
  });

  describe('o mesmo e-mail em duas consultorias (D16)', () => {
    const ambíguo = {
      reason: 'ACCOUNT_SELECTION_REQUIRED',
      accounts: [
        { id: 'acc-1', name: 'Normatiza' },
        { id: 'acc-2', name: 'Consultoria Rival' },
      ],
    };

    it('deve perguntar em qual consultoria a pessoa quer entrar', () => {
      preencher('paulo@ipe.com', 'mesma-senha');
      enviar();

      http.expectOne(`${API}/auth/login`).flush(ambíguo, { status: 409, statusText: 'Conflict' });
      fixture.detectChanges();

      expect(texto()).toContain('Normatiza');
      expect(texto()).toContain('Consultoria Rival');
    });

    it('deve reenviar o login com a consultoria escolhida, sem pedir a senha de novo', async () => {
      preencher('paulo@ipe.com', 'mesma-senha');
      enviar();
      http.expectOne(`${API}/auth/login`).flush(ambíguo, { status: 409, statusText: 'Conflict' });
      fixture.detectChanges();

      const opções = fixture.nativeElement.querySelectorAll('[data-testid="conta"]');
      expect(opções.length).toBe(2);
      (opções[1] as HTMLElement).click();
      fixture.detectChanges();

      const req = http.expectOne(`${API}/auth/login`);
      expect(req.request.body).toEqual({
        email: 'paulo@ipe.com',
        password: 'mesma-senha',
        accountId: 'acc-2',
      });

      req.flush(respostaDeLogin());
      await fixture.whenStable();
    });
  });
});
