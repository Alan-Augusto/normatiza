import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { provideHttpClient } from '@angular/common/http';
import { TestBed } from '@angular/core/testing';
import { firstValueFrom } from 'rxjs';

import { API_BASE_URL } from './api.config';
import { AuthService } from './auth.service';
import { BRF, SEARA, respostaDeLogin, sessão, vínculo } from './testing/sessao';

/**
 * O que estes testes verificam é a **sessão**: quem está logado, com que papéis,
 * e o que sobrevive a um recarregamento de página. O access token nunca sai da
 * memória do processo — é a única razão de o refresh existir em cookie.
 */
describe('AuthService', () => {
  let service: AuthService;
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
    service = TestBed.inject(AuthService);
    http = TestBed.inject(HttpTestingController);
  });

  afterEach(() => http.verify());

  describe('login', () => {
    it('deve guardar o access token e a sessão de quem entrou', async () => {
      const promessa = firstValueFrom(
        service.login({ email: 'marcos@brf.com', password: 'certa' }),
      );

      http.expectOne(`${API}/auth/login`).flush(respostaDeLogin());
      await promessa;

      expect(service.token()).toBe('access.jwt.1');
      expect(service.session()?.user.email).toBe('marcos@brf.com');
      expect(service.isAuthenticated()).toBe(true);
    });

    it('deve enviar as credenciais no corpo, nunca na URL', async () => {
      const promessa = firstValueFrom(
        service.login({ email: 'marcos@brf.com', password: 'certa' }),
      );

      const req = http.expectOne(`${API}/auth/login`);
      expect(req.request.method).toBe('POST');
      expect(req.request.body).toEqual({ email: 'marcos@brf.com', password: 'certa' });
      expect(req.request.urlWithParams).not.toContain('certa');

      req.flush(respostaDeLogin());
      await promessa;
    });

    it('deve pedir o cookie do refresh token junto', async () => {
      // Sem `withCredentials` o navegador descarta o Set-Cookie da API e a
      // sessão morre no primeiro recarregamento — sem erro visível nenhum.
      const promessa = firstValueFrom(
        service.login({ email: 'marcos@brf.com', password: 'certa' }),
      );

      const req = http.expectOne(`${API}/auth/login`);
      expect(req.request.withCredentials).toBe(true);

      req.flush(respostaDeLogin());
      await promessa;
    });

    it('deve repassar a consultoria escolhida quando o login é ambíguo (D16)', async () => {
      const promessa = firstValueFrom(
        service.login({ email: 'paulo@ipe.com', password: 'x', accountId: 'acc-2' }),
      );

      const req = http.expectOne(`${API}/auth/login`);
      expect(req.request.body.accountId).toBe('acc-2');

      req.flush(respostaDeLogin());
      await promessa;
    });

    it('não deve dar por logado quem teve a credencial recusada', async () => {
      const promessa = firstValueFrom(
        service.login({ email: 'marcos@brf.com', password: 'errada' }),
      ).catch(() => 'recusado');

      http
        .expectOne(`${API}/auth/login`)
        .flush({ message: 'E-mail ou senha inválidos.' }, { status: 401, statusText: 'Unauthorized' });

      await promessa;
      expect(service.isAuthenticated()).toBe(false);
      expect(service.token()).toBeNull();
    });
  });

  describe('titular da conta', () => {
    async function entrar(éDono: boolean) {
      const promessa = firstValueFrom(service.login({ email: 'x@y.com', password: 'z' }));
      http
        .expectOne(`${API}/auth/login`)
        .flush(respostaDeLogin({ session: sessão(undefined, false, éDono) }));
      await promessa;
    }

    it('deve reconhecer quem é o titular da conta', async () => {
      await entrar(true);
      expect(service.isAccountOwner()).toBe(true);
    });

    it('não deve reconhecer quem apenas trabalha na conta', async () => {
      // A pergunta é "quem responde pela conta", não "quem tem papel graúdo".
      // Faturamento é do titular.
      await entrar(false);
      expect(service.isAccountOwner()).toBe(false);
    });

    it('não deve reconhecer ninguém antes de alguém entrar', () => {
      expect(service.isAccountOwner()).toBe(false);
    });
  });

  describe('o token vive só na memória', () => {
    it('não deve gravar o access token em storage nenhum', async () => {
      // Token em localStorage é token legível por qualquer script que entre na
      // página. Em memória, ele morre junto com a aba — que é o desejado.
      const promessa = firstValueFrom(
        service.login({ email: 'marcos@brf.com', password: 'certa' }),
      );
      http.expectOne(`${API}/auth/login`).flush(respostaDeLogin());
      await promessa;

      const gravado = [
        ...Object.values(localStorage),
        ...Object.values(sessionStorage),
      ].join('|');
      expect(gravado).not.toContain('access.jwt.1');
    });
  });

  describe('restaurar a sessão no boot (D5)', () => {
    it('deve reerguer a sessão a partir do cookie de refresh', async () => {
      // Recarregar a página zera a memória. Se a sessão não voltasse daqui, o
      // usuário seria deslogado a cada F5, com o refresh token válido no cookie.
      const promessa = firstValueFrom(service.restoreSession());

      const req = http.expectOne(`${API}/auth/refresh`);
      expect(req.request.method).toBe('POST');
      expect(req.request.withCredentials).toBe(true);
      req.flush(respostaDeLogin({ accessToken: 'access.jwt.restaurado' }));

      await promessa;
      expect(service.token()).toBe('access.jwt.restaurado');
      expect(service.isAuthenticated()).toBe(true);
    });

    it('deve seguir anônimo, sem estourar, quando não há cookie válido', async () => {
      // Primeiro acesso e sessão expirada caem aqui. É o caminho normal de quem
      // ainda não entrou — não pode virar tela de erro.
      const promessa = firstValueFrom(service.restoreSession());

      http
        .expectOne(`${API}/auth/refresh`)
        .flush({ message: 'Unauthorized' }, { status: 401, statusText: 'Unauthorized' });

      await expect(promessa).resolves.toBeDefined();
      expect(service.isAuthenticated()).toBe(false);
    });
  });

  describe('logout', () => {
    it('deve limpar a sessão e avisar a API para revogar o refresh token', async () => {
      const entrada = firstValueFrom(service.login({ email: 'marcos@brf.com', password: 'certa' }));
      http.expectOne(`${API}/auth/login`).flush(respostaDeLogin());
      await entrada;

      const saída = firstValueFrom(service.logout());
      const req = http.expectOne(`${API}/auth/logout`);
      expect(req.request.method).toBe('POST');
      req.flush(null);
      await saída;

      expect(service.token()).toBeNull();
      expect(service.session()).toBeNull();
      expect(service.isAuthenticated()).toBe(false);
    });

    it('deve limpar a sessão local mesmo se a API falhar', async () => {
      // API fora do ar não pode ser motivo para o usuário continuar "logado" na
      // tela. O que importa localmente é que a credencial em memória sumiu.
      const entrada = firstValueFrom(service.login({ email: 'marcos@brf.com', password: 'certa' }));
      http.expectOne(`${API}/auth/login`).flush(respostaDeLogin());
      await entrada;

      const saída = firstValueFrom(service.logout()).catch(() => null);
      http.expectOne(`${API}/auth/logout`).flush(null, { status: 500, statusText: 'Server Error' });
      await saída;

      expect(service.isAuthenticated()).toBe(false);
      expect(service.token()).toBeNull();
    });
  });

  describe('papéis', () => {
    async function entrarComo(memberships: Parameters<typeof sessão>[0]) {
      const promessa = firstValueFrom(service.login({ email: 'marcos@brf.com', password: 'certa' }));
      http.expectOne(`${API}/auth/login`).flush(respostaDeLogin({ session: sessão(memberships) }));
      await promessa;
    }

    it('deve devolver os papéis do vínculo na empresa', async () => {
      await entrarComo([vínculo(BRF.id, ['MANAGER'])]);
      expect(service.rolesInCompany(BRF.id)).toEqual(['MANAGER']);
    });

    it('não deve devolver papel nenhum em empresa fora do vínculo', async () => {
      // O isolamento real é do servidor; aqui é o que a tela decide mostrar.
      await entrarComo([vínculo(BRF.id, ['MANAGER'])]);
      expect(service.rolesInCompany(SEARA.id)).toEqual([]);
    });

    it('deve ignorar vínculo desativado', async () => {
      await entrarComo([vínculo(BRF.id, ['MANAGER'], { isActive: false })]);
      expect(service.rolesInCompany(BRF.id)).toEqual([]);
      expect(service.hasRole(['MANAGER'])).toBe(false);
    });

    it('deve reconhecer o papel em qualquer empresa quando nenhuma é informada', async () => {
      await entrarComo([vínculo(SEARA.id, ['CONSULTANT_ENGINEER'])]);
      expect(service.hasRole(['CONSULTANT_ENGINEER'])).toBe(true);
      expect(service.hasRole(['MANAGER'])).toBe(false);
    });

    it('deve exigir que o papel esteja na empresa informada', async () => {
      await entrarComo([vínculo(BRF.id, ['MANAGER']), vínculo(SEARA.id, ['DIRECTOR'])]);
      expect(service.hasRole(['MANAGER'], BRF.id)).toBe(true);
      expect(service.hasRole(['MANAGER'], SEARA.id)).toBe(false);
    });

    it('deve considerar a união dos papéis do mesmo vínculo', async () => {
      await entrarComo([vínculo(BRF.id, ['MANAGER', 'EXECUTOR'])]);
      expect(service.hasRole(['EXECUTOR'], BRF.id)).toBe(true);
      expect(service.hasRole(['MANAGER'], BRF.id)).toBe(true);
    });

    it('não deve reconhecer papel nenhum antes de alguém entrar', () => {
      expect(service.hasRole(['MANAGER'])).toBe(false);
      expect(service.rolesInCompany(BRF.id)).toEqual([]);
    });
  });
});
