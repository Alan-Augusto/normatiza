import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { TestBed } from '@angular/core/testing';
import { firstValueFrom } from 'rxjs';

import { AccountRecoveryService } from './account-recovery.service';
import { API_BASE_URL } from './api.config';

/**
 * As três portas que não passam por senha conhecida: aceitar convite, pedir
 * recuperação e redefinir. Todas carregam um token de uso único, e nenhuma pode
 * carregá-lo na URL da requisição — caminho de URL acaba em log de servidor,
 * histórico de navegador e cabeçalho `Referer`.
 */
describe('AccountRecoveryService', () => {
  let service: AccountRecoveryService;
  let http: HttpTestingController;

  const API = 'http://api.teste';

  beforeEach(() => {
    TestBed.configureTestingModule({
      providers: [
        provideHttpClient(),
        provideHttpClientTesting(),
        { provide: API_BASE_URL, useValue: API },
      ],
    });
    service = TestBed.inject(AccountRecoveryService);
    http = TestBed.inject(HttpTestingController);
  });

  afterEach(() => http.verify());

  it('deve pedir a recuperação pelo e-mail', async () => {
    const promessa = firstValueFrom(service.forgotPassword('marcos@brf.com'));

    const req = http.expectOne(`${API}/auth/forgot-password`);
    expect(req.request.method).toBe('POST');
    expect(req.request.body).toEqual({ email: 'marcos@brf.com' });

    req.flush({ message: 'Se o e-mail existir, enviaremos as instruções.' });
    await promessa;
  });

  it('deve redefinir a senha com o token no corpo, nunca na URL', async () => {
    const promessa = firstValueFrom(service.resetPassword('tok-123', 'nova-senha'));

    const req = http.expectOne(`${API}/auth/reset-password`);
    expect(req.request.body).toEqual({ token: 'tok-123', password: 'nova-senha' });
    expect(req.request.urlWithParams).not.toContain('tok-123');

    req.flush(null);
    await promessa;
  });

  it('deve aceitar o convite com o token no corpo, nunca na URL', async () => {
    const promessa = firstValueFrom(service.acceptInvitation('convite-abc', 'minha-senha'));

    const req = http.expectOne(`${API}/invitations/accept`);
    expect(req.request.method).toBe('POST');
    expect(req.request.body).toEqual({ token: 'convite-abc', password: 'minha-senha' });
    expect(req.request.urlWithParams).not.toContain('convite-abc');

    req.flush(null);
    await promessa;
  });
});
