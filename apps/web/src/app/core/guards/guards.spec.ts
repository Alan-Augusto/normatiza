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
import { firstValueFrom, isObservable, type Observable } from 'rxjs';

import { API_BASE_URL } from '../auth/api.config';
import { AuthService } from '../auth/auth.service';
import { CONTEXTO_1 } from '../auth/entry-route';
import { BRF, SEARA, respostaDeLogin, sessão, vínculo } from '../auth/testing/sessao';
import { accountOwnerGuard } from './account-owner.guard';
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

  function rodar(guard: CanActivateFn, url = '/app/painel', params: Record<string, string> = {}) {
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
      expect(router.serializeUrl(resultado as UrlTree)).toContain('/entrar');
    });

    it('deve lembrar para onde a pessoa ia, para voltar depois do login', () => {
      // Quem clicou num link de um equipamento específico e foi parar no login
      // precisa cair no equipamento depois de entrar, não num dashboard genérico.
      const resultado = rodar(authGuard, '/app/empresas/brf/equipamentos/xyz');
      const url = router.serializeUrl(resultado as UrlTree);
      expect(url).toContain('returnUrl');
      expect(decodeURIComponent(url)).toContain('/app/empresas/brf/equipamentos/xyz');
    });
  });

  describe('adminGuard', () => {
    it('deve deixar passar o admin da plataforma', async () => {
      await entrarComo([], true);
      expect(rodar(adminGuard, '/admin/contas')).toBe(true);
    });

    it('deve deixar passar quem é admin da plataforma e também da própria consultoria', async () => {
      // Um login só para quem é as duas coisas — o caso do dono do produto.
      await entrarComo([vínculo(BRF.id, ['LEAD_ENGINEER'])], true);
      expect(rodar(adminGuard, '/admin/contas')).toBe(true);
    });

    it('deve barrar o Engenheiro Responsável que não é admin da plataforma', async () => {
      // Ser dono da consultoria não é ser dono da plataforma.
      await entrarComo([vínculo(BRF.id, ['LEAD_ENGINEER'])]);
      expect(rodar(adminGuard, '/admin/contas')).not.toBe(true);
    });

    it('não deve devolver um destino que outra guarda recusaria', async () => {
      // O mesmo laço do `roleGuard`: barrar um Gestor no `/admin` e mandá-lo
      // para `/app` o joga no ciclo do Contexto 1.
      await entrarComo([vínculo(BRF.id, ['MANAGER'])]);

      const destino = rodar(adminGuard, '/admin/contas');
      const url = router.serializeUrl(destino as UrlTree);

      expect(url).not.toBe('/app');
      expect(url).toBe(`/app/empresas/${BRF.slug}/painel`);
    });

    it('deve barrar o anônimo', () => {
      expect(rodar(adminGuard, '/admin/contas')).not.toBe(true);
    });
  });

  describe('accountOwnerGuard', () => {
    async function entrarComoDono(éDono: boolean) {
      const promessa = firstValueFrom(auth.login({ email: 'x@y.com', password: 'z' }));
      http
        .expectOne(`${API}/auth/login`)
        .flush(
          respostaDeLogin({
            session: sessão([vínculo(BRF.id, ['LEAD_ENGINEER'])], false, éDono),
          }),
        );
      await promessa;
    }

    it('deve deixar passar o titular da conta', async () => {
      await entrarComoDono(true);
      expect(rodar(accountOwnerGuard, '/app/assinatura')).toBe(true);
    });

    it('deve barrar quem trabalha na conta mas não a titulariza', async () => {
      // Faturamento é de quem responde pela conta. Ter papel graúdo não é o
      // mesmo que pagar a fatura.
      await entrarComoDono(false);
      expect(rodar(accountOwnerGuard, '/app/assinatura')).not.toBe(true);
    });

    it('deve barrar o lado cliente', async () => {
      await entrarComo([vínculo(BRF.id, ['MANAGER'])]);
      expect(rodar(accountOwnerGuard, '/app/assinatura')).not.toBe(true);
    });

    it('deve mandar o recusado para a porta de entrada dele, e não para /app', async () => {
      await entrarComo([vínculo(BRF.id, ['MANAGER'])]);

      const destino = rodar(accountOwnerGuard, '/app/assinatura');
      expect(router.serializeUrl(destino as UrlTree)).toBe(
        `/app/empresas/${BRF.slug}/painel`,
      );
    });

    it('deve mandar o anônimo para o login', () => {
      const destino = rodar(accountOwnerGuard, '/app/assinatura');
      expect(router.serializeUrl(destino as UrlTree)).toContain('/entrar');
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

    it('deve exigir o papel na empresa da rota, que a URL nomeia pelo slug', async () => {
      // O Gestor da BRF não vira Gestor da Seara por a rota mudar de parâmetro.
      await entrarComo([vínculo(BRF.id, ['MANAGER']), vínculo(SEARA.id, ['DIRECTOR'])]);

      expect(rodar(roleGuard(['MANAGER']), '/app/empresas/brf/painel', { companySlug: 'brf' })).toBe(true);
      expect(
        rodar(roleGuard(['MANAGER']), '/app/empresas/seara/painel', { companySlug: 'seara' }),
      ).not.toBe(true);
    });

    it('deve achar a empresa num nível acima da rota guardada, como em equipamentos/novo', async () => {
      await entrarComo([vínculo(BRF.id, ['DIRECTOR']), vínculo(SEARA.id, ['MANAGER'])]);
      const empresa = { params: { companySlug: 'brf' } };
      const filha = { params: {}, data: {}, pathFromRoot: [empresa] } as unknown as ActivatedRouteSnapshot;
      filha.pathFromRoot.push(filha);

      // A Débora é Diretora na BRF: ser Gestora na Seara não a deixa cadastrar na BRF.
      const resultado = TestBed.runInInjectionContext(() =>
        roleGuard(['MANAGER'])(filha, { url: '/app/empresas/brf/equipamentos/novo' } as RouterStateSnapshot),
      );
      expect(resultado).not.toBe(true);
    });

    describe('um slug que a sessão não conhece', () => {
      async function resolver(resultado: unknown) {
        return firstValueFrom(resultado as Observable<boolean | UrlTree>);
      }

      it('deve levar o endereço antigo ao atual, mantendo a tela que a pessoa pediu', async () => {
        // A BRF se chamava "BRF Concórdia": o favorito antigo ainda abre.
        await entrarComo([vínculo(BRF.id, ['MANAGER'])]);

        const resultado = rodar(roleGuard(['MANAGER']), '/app/empresas/brf-concordia/equipe', {
          companySlug: 'brf-concordia',
        });
        expect(isObservable(resultado)).toBe(true);
        const destino = resolver(resultado);
        http.expectOne(`${API}/companies/by-slug/brf-concordia`).flush({ id: BRF.id, slug: 'brf' });

        expect(router.serializeUrl((await destino) as UrlTree)).toBe('/app/empresas/brf/equipe');
      });

      it('deve mandar para a porta de entrada quando a empresa não existe para quem pergunta', async () => {
        await entrarComo([vínculo(BRF.id, ['MANAGER'])]);

        const destino = resolver(
          rodar(roleGuard(['MANAGER']), '/app/empresas/outra/painel', { companySlug: 'outra' }),
        );
        http
          .expectOne(`${API}/companies/by-slug/outra`)
          .flush(null, { status: 404, statusText: 'Not Found' });

        expect(router.serializeUrl((await destino) as UrlTree)).toBe('/app/empresas/brf/painel');
      });

      it('não deve deixar o endereço antigo virar atalho para uma empresa sem o papel pedido', async () => {
        await entrarComo([vínculo(BRF.id, ['DIRECTOR'])]);

        const destino = resolver(
          rodar(roleGuard(['MANAGER']), '/app/empresas/brf-concordia/equipe', {
            companySlug: 'brf-concordia',
          }),
        );
        http.expectOne(`${API}/companies/by-slug/brf-concordia`).flush({ id: BRF.id, slug: 'brf' });

        expect(router.serializeUrl((await destino) as UrlTree)).not.toContain('/equipe');
      });
    });

    /**
     * O destino da recusa não pode ser uma rota que a mesma guarda recusaria.
     *
     * `/app` redireciona para `/app/painel`, que é guardado pelo Contexto 1.
     * Mandar para lá quem acabou de ser recusado pelo Contexto 1 fecha um ciclo
     * — `/app` → `dashboard` → recusa → `/app` — e o roteador não tem freio
     * para isso: o laço é síncrono e trava a aba do navegador.
     */
    it('não deve devolver um destino que ela mesma recusaria', async () => {
      await entrarComo([vínculo(BRF.id, ['MANAGER'])]);

      const destino = rodar(roleGuard(CONTEXTO_1), '/app/painel');
      const url = router.serializeUrl(destino as UrlTree);

      expect(url).not.toBe('/app');
      expect(url).not.toBe('/app/painel');
    });

    it('deve mandar o recusado para a porta de entrada dele', async () => {
      await entrarComo([vínculo(BRF.id, ['MANAGER'])]);

      const destino = rodar(roleGuard(CONTEXTO_1), '/app/painel');

      expect(router.serializeUrl(destino as UrlTree)).toBe(
        `/app/empresas/${BRF.slug}/painel`,
      );
    });

    it('deve mandar para o perfil quem não tem porta de entrada nenhuma', async () => {
      // Sem vínculo ativo não há dashboard nem empresa para onde ir, e `/app`
      // seria o laço de novo. O perfil não é guardado por papel.
      await entrarComo([]);

      const destino = rodar(roleGuard(CONTEXTO_1), '/app/painel');

      expect(router.serializeUrl(destino as UrlTree)).toBe('/app/perfil');
    });

    it('deve mandar o anônimo para o login, e não para uma tela de acesso negado', async () => {
      // Quem não entrou não tem "acesso negado" — tem login pendente.
      const resultado = rodar(roleGuard(['MANAGER']));
      expect(resultado).toBeInstanceOf(UrlTree);
      expect(router.serializeUrl(resultado as UrlTree)).toContain('/entrar');
    });
  });
});
