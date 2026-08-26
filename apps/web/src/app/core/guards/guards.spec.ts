import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { TestBed } from '@angular/core/testing';
import {
  ActivatedRouteSnapshot,
  CanActivateFn,
  Router,
  RouterStateSnapshot,
  UrlTree,
  provideRouter,
} from '@angular/router';
import { firstValueFrom } from 'rxjs';

import { API_BASE_URL } from '../auth/api.config';
import { AuthService } from '../auth/auth.service';
import { BRF, SEARA, respostaDeLogin, sessão, vínculo } from '../auth/testing/sessao';
import { adminGuard } from './admin.guard';
import { authGuard } from './auth.guard';
import { roleGuard } from './role.guard';

/**
 * As guardas decidem **navegação**, não permissão: quem burla uma delas com o
 * devtools aberto continua esbarrando no servidor. O que se verifica aqui é que
 * a pessoa certa não é barrada e a errada não vê uma tela vazia sem explicação.
 */
describe('guardas de rota', () => {
  let auth: AuthService;
  let http: HttpTestingController;
  let router: Router;

  const API = 'http://api.teste';

  beforeEach(() => {
    TestBed.configureTestingModule({
      providers: [
        provideRouter([]),
        provideHttpClient(),
        provideHttpClientTesting(),
        { provide: API_BASE_URL, useValue: API },
      ],
    });
    auth = TestBed.inject(AuthService);
    http = TestBed.inject(HttpTestingController);
    router = TestBed.inject(Router);
  });

  afterEach(() => http.verify());

  async function entrarComo(
    memberships: Parameters<typeof sessão>[0],
    isPlatformAdmin = false,
  ) {
    const promessa = firstValueFrom(auth.login({ email: 'marcos@brf.com', password: 'certa' }));
    http
      .expectOne(`${API}/auth/login`)
      .flush(respostaDeLogin({ session: sessão(memberships, isPlatformAdmin) }));
    await promessa;
  }

  function rodar(guard: CanActivateFn, url = '/app/dashboard', params: Record<string, string> = {}) {
    const route = { params, data: {} } as unknown as ActivatedRouteSnapshot;
    const state = { url } as RouterStateSnapshot;
    return TestBed.runInInjectionContext(() => guard(route, state));
  }

  describe('authGuard', () => {
    it('deve deixar passar quem tem sessão', async () => {
      await entrarComo([vínculo(BRF.id, ['MANAGER'])]);
      expect(rodar(authGuard)).toBe(true);
    });

    it('deve mandar o anônimo para o login', () => {
      const resultado = rodar(authGuard);
      expect(resultado).toBeInstanceOf(UrlTree);
      expect(router.serializeUrl(resultado as UrlTree)).toContain('/login');
    });

    it('deve lembrar para onde a pessoa ia, para voltar depois do login', () => {
      // Quem clicou num link de um equipamento específico e foi parar no login
      // precisa cair no equipamento depois de entrar, não num dashboard genérico.
      const resultado = rodar(authGuard, '/app/companies/brf/equipments/xyz');
      const url = router.serializeUrl(resultado as UrlTree);
      expect(url).toContain('returnUrl');
      expect(decodeURIComponent(url)).toContain('/app/companies/brf/equipments/xyz');
    });
  });

  describe('adminGuard', () => {
    it('deve deixar passar o admin da plataforma', async () => {
      await entrarComo([], true);
      expect(rodar(adminGuard, '/admin/accounts')).toBe(true);
    });

    it('deve deixar passar quem é admin da plataforma e também da própria consultoria', async () => {
      // Um login só para quem é as duas coisas — o caso do dono do produto.
      await entrarComo([vínculo(BRF.id, ['LEAD_ENGINEER'])], true);
      expect(rodar(adminGuard, '/admin/accounts')).toBe(true);
    });

    it('deve barrar o Engenheiro Responsável que não é admin da plataforma', async () => {
      // Ser dono da consultoria não é ser dono da plataforma.
      await entrarComo([vínculo(BRF.id, ['LEAD_ENGINEER'])]);
      expect(rodar(adminGuard, '/admin/accounts')).not.toBe(true);
    });

    it('deve barrar o anônimo', () => {
      expect(rodar(adminGuard, '/admin/accounts')).not.toBe(true);
    });
  });

  describe('roleGuard', () => {
    it('deve deixar passar quem tem um dos papéis pedidos', async () => {
      await entrarComo([vínculo(BRF.id, ['MANAGER'])]);
      expect(rodar(roleGuard(['MANAGER', 'CLIENT_ENGINEER']))).toBe(true);
    });

    it('deve barrar quem não tem nenhum dos papéis pedidos', async () => {
      await entrarComo([vínculo(BRF.id, ['EXECUTOR'])]);
      expect(rodar(roleGuard(['MANAGER']))).not.toBe(true);
    });

    it('deve exigir o papel na empresa da rota', async () => {
      // O Gestor da BRF não vira Gestor da Seara por a rota mudar de parâmetro.
      await entrarComo([vínculo(BRF.id, ['MANAGER'])]);

      expect(rodar(roleGuard(['MANAGER']), '/app/companies/x', { companyId: BRF.id })).toBe(true);
      expect(rodar(roleGuard(['MANAGER']), '/app/companies/y', { companyId: SEARA.id })).not.toBe(
        true,
      );
    });

    it('deve mandar o anônimo para o login, e não para uma tela de acesso negado', async () => {
      // Quem não entrou não tem "acesso negado" — tem login pendente.
      const resultado = rodar(roleGuard(['MANAGER']));
      expect(resultado).toBeInstanceOf(UrlTree);
      expect(router.serializeUrl(resultado as UrlTree)).toContain('/login');
    });
  });
});
