import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { ComponentFixture, TestBed } from '@angular/core/testing';
import { provideRouter } from '@angular/router';

import { API_BASE_URL } from '../../../core/auth/api.config';
import { ForgotPasswordComponent } from './forgot-password.component';

/**
 * "Esqueci minha senha".
 *
 * A tela responde a mesma coisa para e-mail existente e inexistente — de
 * propósito, porque distinguir os dois casos a transformaria num oráculo de
 * quem é cliente de quem. O preço disso é que ela **também** parece bem
 * sucedida quando nada saiu daqui, e é justamente esse ponto cego que estes
 * testes cobrem.
 */
describe('ForgotPasswordComponent', () => {
  let fixture: ComponentFixture<ForgotPasswordComponent>;
  let http: HttpTestingController;

  const API = 'http://api.teste';

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [ForgotPasswordComponent],
      providers: [
        provideRouter([]),
        provideHttpClient(),
        provideHttpClientTesting(),
        { provide: API_BASE_URL, useValue: API },
      ],
    }).compileComponents();

    fixture = TestBed.createComponent(ForgotPasswordComponent);
    http = TestBed.inject(HttpTestingController);
    fixture.detectChanges();
  });

  afterEach(() => http.verify());

  const el = (seletor: string) =>
    (fixture.nativeElement as HTMLElement).querySelector(seletor) as HTMLElement | null;
  const texto = () => (fixture.nativeElement as HTMLElement).textContent ?? '';

  function preencher(email: string) {
    const campo = el('[data-testid="email"]') as HTMLInputElement;
    campo.value = email;
    campo.dispatchEvent(new Event('input'));
    fixture.detectChanges();
  }

  function enviar() {
    (el('form') as HTMLFormElement).dispatchEvent(new Event('submit'));
    fixture.detectChanges();
  }

  it('deve pedir a recuperação para o e-mail informado', () => {
    preencher('augustoalan56@gmail.com');
    enviar();

    const req = http.expectOne(`${API}/auth/forgot-password`);
    expect(req.request.method).toBe('POST');
    expect(req.request.body).toEqual({ email: 'augustoalan56@gmail.com' });

    req.flush({ message: 'ok' });
    fixture.detectChanges();

    expect(el('[data-testid="enviado"]')).not.toBeNull();
  });

  it('deve aceitar o e-mail com espaço em volta, em vez de engolir o clique', () => {
    // Copiar e colar traz espaço junto. Sem o corte, `Validators.email` reprova,
    // o `submit` retorna sem fazer nada e a tela fica parada sem dizer por quê —
    // que é exatamente o que parece um sistema quebrado.
    preencher('  augustoalan56@gmail.com  ');
    enviar();

    const req = http.expectOne(`${API}/auth/forgot-password`);
    expect(req.request.body).toEqual({ email: 'augustoalan56@gmail.com' });
    req.flush({ message: 'ok' });
  });

  it('não deve enviar formulário vazio', () => {
    enviar();
    http.expectNone(`${API}/auth/forgot-password`);
  });

  it('deve dizer o que houve quando nada saiu daqui', () => {
    // Sigilo é sobre **existir ou não a conta** — não sobre a rede ter caído.
    // Mostrar "enviamos as instruções" depois de um erro de transporte manda a
    // pessoa esperar um e-mail que ninguém tentou mandar.
    preencher('augustoalan56@gmail.com');
    enviar();

    http.expectOne(`${API}/auth/forgot-password`).error(new ProgressEvent('erro de rede'));
    fixture.detectChanges();

    expect(el('[data-testid="enviado"]')).toBeNull();
    expect(el('[data-testid="erro"]')).not.toBeNull();
  });

  it('deve continuar dizendo o mesmo quando o e-mail não existe', () => {
    // O 202 é igual nos dois casos, e a tela não tem como distinguir — nem deve.
    preencher('ninguem@lugar-nenhum.com');
    enviar();

    http.expectOne(`${API}/auth/forgot-password`).flush({ message: 'ok' });
    fixture.detectChanges();

    expect(texto()).toContain('Se esse e-mail estiver cadastrado');
  });
});
