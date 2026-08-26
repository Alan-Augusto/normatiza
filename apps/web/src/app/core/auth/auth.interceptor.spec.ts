import { HttpClient, provideHttpClient, withInterceptors } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { TestBed } from '@angular/core/testing';
import { Router } from '@angular/router';
import { firstValueFrom } from 'rxjs';

import { API_BASE_URL } from './api.config';
import { authInterceptor } from './auth.interceptor';
import { AuthService } from './auth.service';
import { respostaDeLogin } from './testing/sessao';

/**
 * O interceptor é o que torna os 15 minutos do access token invisíveis para
 * quem usa o sistema. Se ele errar, ou o usuário é deslogado no meio do
 * trabalho, ou o front entra em laço de refresh contra a API.
 */
describe('authInterceptor', () => {
  let http: HttpTestingController;
  let client: HttpClient;
  let auth: AuthService;
  let navegou: string[];

  const API = 'http://api.teste';

  beforeEach(() => {
    navegou = [];
    TestBed.configureTestingModule({
      providers: [
        provideHttpClient(withInterceptors([authInterceptor])),
        provideHttpClientTesting(),
        { provide: API_BASE_URL, useValue: API },
        { provide: Router, useValue: { navigate: (rota: unknown[]) => navegou.push(String(rota[0])) } },
      ],
    });
    http = TestBed.inject(HttpTestingController);
    client = TestBed.inject(HttpClient);
    auth = TestBed.inject(AuthService);
  });

  afterEach(() => http.verify());

  /** Deixa uma sessão ativa, como se o usuário tivesse acabado de entrar. */
  async function autenticado(token = 'access.jwt.1') {
    const promessa = firstValueFrom(auth.login({ email: 'marcos@brf.com', password: 'certa' }));
    http.expectOne(`${API}/auth/login`).flush(respostaDeLogin({ accessToken: token }));
    await promessa;
  }

  describe('o token nas chamadas', () => {
    it('deve mandar o access token nas chamadas da API', async () => {
      await autenticado();

      const promessa = firstValueFrom(client.get(`${API}/companies`));
      const req = http.expectOne(`${API}/companies`);
      expect(req.request.headers.get('Authorization')).toBe('Bearer access.jwt.1');

      req.flush([]);
      await promessa;
    });

    it('não deve mandar Authorization quando ninguém entrou', async () => {
      const promessa = firstValueFrom(client.get(`${API}/health`));
      const req = http.expectOne(`${API}/health`);
      expect(req.request.headers.has('Authorization')).toBe(false);

      req.flush({});
      await promessa;
    });

    it('não deve mandar o token para fora da API', async () => {
      // Um CEP, um mapa, um CDN — nada disso tem por que receber a credencial
      // da sessão só porque a chamada passou pelo mesmo HttpClient.
      await autenticado();

      const promessa = firstValueFrom(client.get('https://viacep.com.br/ws/01001000/json/'));
      const req = http.expectOne('https://viacep.com.br/ws/01001000/json/');
      expect(req.request.headers.has('Authorization')).toBe(false);
      expect(req.request.withCredentials).toBe(false);

      req.flush({});
      await promessa;
    });

    it('deve enviar o cookie do refresh nas chamadas da API', async () => {
      await autenticado();

      const promessa = firstValueFrom(client.get(`${API}/companies`));
      const req = http.expectOne(`${API}/companies`);
      expect(req.request.withCredentials).toBe(true);

      req.flush([]);
      await promessa;
    });
  });

  describe('refresh silencioso no 401', () => {
    it('deve renovar a sessão e repetir a chamada que falhou', async () => {
      await autenticado('access.jwt.velho');

      const promessa = firstValueFrom(client.get<{ ok: boolean }>(`${API}/companies`));

      http
        .expectOne(`${API}/companies`)
        .flush({ message: 'Unauthorized' }, { status: 401, statusText: 'Unauthorized' });

      http.expectOne(`${API}/auth/refresh`).flush(respostaDeLogin({ accessToken: 'access.jwt.novo' }));

      const repetida = http.expectOne(`${API}/companies`);
      expect(repetida.request.headers.get('Authorization')).toBe('Bearer access.jwt.novo');
      repetida.flush({ ok: true });

      await expect(promessa).resolves.toEqual({ ok: true });
    });

    it('deve tentar o refresh uma única vez por chamada', async () => {
      // Sem este limite, um 401 que persiste depois do refresh vira laço
      // infinito de requisições contra a API.
      await autenticado();

      const promessa = firstValueFrom(client.get(`${API}/companies`)).catch(() => 'falhou');

      http.expectOne(`${API}/companies`).flush({}, { status: 401, statusText: 'Unauthorized' });
      http.expectOne(`${API}/auth/refresh`).flush(respostaDeLogin({ accessToken: 'access.jwt.novo' }));
      http.expectOne(`${API}/companies`).flush({}, { status: 401, statusText: 'Unauthorized' });

      await promessa;
      http.expectNone(`${API}/auth/refresh`);
    });

    it('deve deslogar e mandar para o login quando o refresh também falha', async () => {
      await autenticado();

      const promessa = firstValueFrom(client.get(`${API}/companies`)).catch(() => 'falhou');

      http.expectOne(`${API}/companies`).flush({}, { status: 401, statusText: 'Unauthorized' });
      http.expectOne(`${API}/auth/refresh`).flush({}, { status: 401, statusText: 'Unauthorized' });

      await promessa;
      expect(auth.isAuthenticated()).toBe(false);
      expect(navegou).toContain('/login');
    });

    it('não deve tentar refresh quando é o próprio refresh que falha', async () => {
      // O refresh falhando é o fim da sessão, não um caso de renovar de novo.
      const promessa = firstValueFrom(auth.restoreSession());

      http.expectOne(`${API}/auth/refresh`).flush({}, { status: 401, statusText: 'Unauthorized' });

      await promessa;
      http.expectNone(`${API}/auth/refresh`);
    });

    it('não deve tentar refresh quando o 401 é de credencial errada no login', async () => {
      // Senha errada não é sessão expirada. Tentar renovar aqui esconderia o
      // erro real do usuário atrás de uma segunda falha.
      const promessa = firstValueFrom(
        auth.login({ email: 'marcos@brf.com', password: 'errada' }),
      ).catch(() => 'recusado');

      http.expectOne(`${API}/auth/login`).flush({}, { status: 401, statusText: 'Unauthorized' });

      await promessa;
      http.expectNone(`${API}/auth/refresh`);
    });

    it('não deve renovar a sessão por causa de um 403', async () => {
      // 403 é permissão insuficiente, e nenhum token novo resolve isso.
      await autenticado();

      const promessa = firstValueFrom(client.get(`${API}/admin/accounts`)).catch(() => 'proibido');

      http.expectOne(`${API}/admin/accounts`).flush({}, { status: 403, statusText: 'Forbidden' });

      await promessa;
      http.expectNone(`${API}/auth/refresh`);
      expect(auth.isAuthenticated()).toBe(true);
    });
  });

  describe('chamadas concorrentes', () => {
    it('deve disparar um único refresh para várias chamadas que caíram juntas', async () => {
      // Um dashboard abre seis requisições de uma vez. Se cada 401 disparasse o
      // seu refresh, cinco deles chegariam com o token já rotacionado — e a
      // detecção de reúso do servidor derrubaria a família inteira, deslogando
      // o usuário exatamente por ter tentado renovar direito.
      await autenticado('access.jwt.velho');

      const a = firstValueFrom(client.get<{ n: number }>(`${API}/companies`));
      const b = firstValueFrom(client.get<{ n: number }>(`${API}/equipments`));

      http.expectOne(`${API}/companies`).flush({}, { status: 401, statusText: 'Unauthorized' });
      http.expectOne(`${API}/equipments`).flush({}, { status: 401, statusText: 'Unauthorized' });

      const refreshes = http.match(`${API}/auth/refresh`);
      expect(refreshes).toHaveLength(1);
      refreshes[0].flush(respostaDeLogin({ accessToken: 'access.jwt.novo' }));

      const repetidaA = http.expectOne(`${API}/companies`);
      const repetidaB = http.expectOne(`${API}/equipments`);
      expect(repetidaA.request.headers.get('Authorization')).toBe('Bearer access.jwt.novo');
      expect(repetidaB.request.headers.get('Authorization')).toBe('Bearer access.jwt.novo');
      repetidaA.flush({ n: 1 });
      repetidaB.flush({ n: 2 });

      await expect(Promise.all([a, b])).resolves.toEqual([{ n: 1 }, { n: 2 }]);
    });

    it('deve derrubar todas as chamadas pendentes quando o refresh compartilhado falha', async () => {
      await autenticado();

      const a = firstValueFrom(client.get(`${API}/companies`)).catch(() => 'falhou');
      const b = firstValueFrom(client.get(`${API}/equipments`)).catch(() => 'falhou');

      http.expectOne(`${API}/companies`).flush({}, { status: 401, statusText: 'Unauthorized' });
      http.expectOne(`${API}/equipments`).flush({}, { status: 401, statusText: 'Unauthorized' });

      http.match(`${API}/auth/refresh`)[0].flush({}, { status: 401, statusText: 'Unauthorized' });

      await expect(Promise.all([a, b])).resolves.toEqual(['falhou', 'falhou']);
      expect(auth.isAuthenticated()).toBe(false);
    });

    it('deve permitir um novo refresh depois de o anterior ter terminado', async () => {
      // O refresh compartilhado não pode virar um "já tentei uma vez" eterno:
      // meia hora depois, o access token expira de novo e a renovação precisa
      // acontecer normalmente.
      await autenticado('access.jwt.1');

      const primeira = firstValueFrom(client.get(`${API}/companies`));
      http.expectOne(`${API}/companies`).flush({}, { status: 401, statusText: 'Unauthorized' });
      http.expectOne(`${API}/auth/refresh`).flush(respostaDeLogin({ accessToken: 'access.jwt.2' }));
      http.expectOne(`${API}/companies`).flush([]);
      await primeira;

      const segunda = firstValueFrom(client.get(`${API}/equipments`));
      http.expectOne(`${API}/equipments`).flush({}, { status: 401, statusText: 'Unauthorized' });
      http.expectOne(`${API}/auth/refresh`).flush(respostaDeLogin({ accessToken: 'access.jwt.3' }));
      const repetida = http.expectOne(`${API}/equipments`);
      expect(repetida.request.headers.get('Authorization')).toBe('Bearer access.jwt.3');
      repetida.flush([]);
      await segunda;
    });
  });
});
