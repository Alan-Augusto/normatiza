import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { Component } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { Router, provideRouter } from '@angular/router';
import { RouterTestingHarness } from '@angular/router/testing';
import { firstValueFrom } from 'rxjs';

import type { CompanyListItem, MembershipWithCompany } from '@normatiza/shared';

import { API_BASE_URL } from '../../../core/auth/api.config';
import { AuthService } from '../../../core/auth/auth.service';
import { BRF, SEARA, respostaDeLogin, sessão, vínculo } from '../../../core/auth/testing/sessao';
import { CARTEIRA, NADA, linhaDeEmpresa, perfilDaBrf } from '../../../core/services/testing/empresas';
import { escolher } from '../../../core/testing/prime';
import { CompaniesComponent } from './companies.component';

@Component({ template: '' })
class Destino {}

/**
 * Empresas — Contexto 1 ([03 §3.2](../../../../../../../docs/produto/03_navegacao_e_telas.md)).
 *
 * A carteira em tabela. O que estes testes protegem: a tela não inventa número
 * que não existe, não oferece o que a alçada de quem olha não alcança, e não
 * confunde "carteira vazia" com "busca sem resultado".
 */
describe('CompaniesComponent', () => {
  let http: HttpTestingController;
  let harness: RouterTestingHarness;

  const API = 'http://api.teste';

  beforeEach(() => {
    TestBed.configureTestingModule({
      providers: [
        provideRouter([
          { path: 'app/empresas', component: CompaniesComponent },
          { path: 'app/empresas/nova', component: Destino },
          { path: 'app/empresas/:companyId/editar', component: Destino },
          { path: 'app/empresas/:companyId/painel', component: Destino },
        ]),
        provideHttpClient(),
        provideHttpClientTesting(),
        { provide: API_BASE_URL, useValue: API },
      ],
    });
    http = TestBed.inject(HttpTestingController);
  });

  afterEach(() => http.verify());

  async function entrarComo(memberships: MembershipWithCompany[], éDono = false) {
    const auth = TestBed.inject(AuthService);
    const login = firstValueFrom(auth.login({ email: 'quem@seja.com', password: 'certa' }));
    http.expectOne(`${API}/auth/login`).flush(respostaDeLogin({ session: sessão(memberships, false, éDono) }));
    await login;
  }

  /** Abre a carteira na URL dada e responde a primeira busca com `carteira`. */
  async function abrir(url = '/app/empresas', carteira: CompanyListItem[] = CARTEIRA) {
    harness = await RouterTestingHarness.create();
    await harness.navigateByUrl(url, CompaniesComponent);
    http.expectOne((r) => r.url === `${API}/companies`).flush(carteira);
    harness.detectChanges();
  }

  const comoJosué = () =>
    entrarComo([vínculo(BRF.id, ['LEAD_ENGINEER']), vínculo(SEARA.id, ['LEAD_ENGINEER'])], true);
  const comoCarla = () => entrarComo([vínculo(BRF.id, ['CONSULTANT_ENGINEER'])]);
  const comoFernando = () => entrarComo([vínculo(BRF.id, ['TECHNICIAN'])]);

  const raiz = () => harness.routeNativeElement as HTMLElement;
  const texto = () => raiz().textContent ?? '';
  const el = (seletor: string) => raiz().querySelector<HTMLElement>(seletor);
  const linhaDe = (id: string) => el(`[data-testid="linha"][data-company="${id}"]`);
  const esperar = (ms: number) => new Promise((r) => setTimeout(r, ms));

  describe('a tabela', () => {
    it('deve mostrar a carteira com CNPJ formatado, cidade e Gestor', async () => {
      await comoJosué();
      await abrir();

      const brf = linhaDe(BRF.id)!;
      expect(brf.textContent).toContain('BRF');
      // A razão social não disputa espaço com o nome pelo qual a empresa é chamada.
      expect(brf.textContent).not.toContain('BRF S.A.');
      expect(brf.textContent).toContain('22.222.222/0001-91');
      expect(brf.textContent).toContain('Concórdia/SC');
      expect(brf.textContent).toContain('Marcos');
    });

    it('deve mostrar o logo ao lado do nome, e o ícone de empresa quando não há logo', async () => {
      await comoJosué();
      await abrir('/app/empresas', [
        linhaDeEmpresa({ logoUrl: 'https://arquivos.teste/brf.png' }),
        { ...CARTEIRA[1] },
      ]);

      expect(linhaDe(BRF.id)!.querySelector('app-company-logo img')?.getAttribute('src')).toBe('https://arquivos.teste/brf.png');
      expect(linhaDe(SEARA.id)!.querySelector('app-company-logo img')).toBeNull();
      expect(linhaDe(SEARA.id)!.querySelector('app-company-logo ng-icon')).not.toBeNull();
    });

    it('deve mostrar zero onde é zero, e "—" onde ainda não há medida', async () => {
      // Sem análise não há grau de adequação: "0%" diria que nada foi adequado.
      await comoJosué();
      await abrir();

      expect(el(`[data-company="${BRF.id}"] [data-testid="equipamentos"]`)!.textContent!.trim()).toBe('0');
      expect(el(`[data-company="${BRF.id}"] [data-testid="pontos-abertos"]`)!.textContent!.trim()).toBe('0');
      expect(el(`[data-company="${BRF.id}"] [data-testid="adequacao"]`)!.textContent!.trim()).toBe('—');
      expect(el(`[data-company="${BRF.id}"] [data-testid="ultima-analise"]`)!.textContent!.trim()).toBe('—');
    });

    it('deve mostrar o grau de adequação quando ele existir', async () => {
      await comoJosué();
      await abrir('/app/empresas', [linhaDeEmpresa({ adequacyPercent: 72.4 })]);

      expect(el('[data-testid="adequacao"]')!.textContent!.trim()).toBe('72%');
    });

    it('deve dizer em palavras em que pé está cada empresa', async () => {
      await comoJosué();
      await abrir();

      expect(linhaDe(BRF.id)!.textContent).toContain('Ativa');
      expect(linhaDe(SEARA.id)!.textContent).toContain('Em implantação');
      expect(linhaDe(SEARA.id)!.textContent).toContain('Sem Gestor');
    });

    it('deve avisar que o Gestor ainda não aceitou o convite', async () => {
      await comoJosué();
      await abrir('/app/empresas', [
        linhaDeEmpresa({ status: 'AWAITING_MANAGER', managers: [{ id: 'u', name: 'Helena', pending: true }] }),
      ]);

      expect(el('[data-testid="linha"]')!.textContent).toContain('Helena');
      expect(el('[data-testid="gestor-pendente"]')).not.toBeNull();
    });

    it('deve levar ao Contexto 2 pelo nome da empresa', async () => {
      await comoJosué();
      await abrir();

      const link = el(`[data-company="${BRF.id}"] [data-testid="abrir-empresa"]`) as HTMLAnchorElement;
      expect(link.getAttribute('href')).toBe(`/app/empresas/${BRF.id}/painel`);
    });

    it('deve entrar na empresa clicando em qualquer ponto da linha', async () => {
      await comoJosué();
      await abrir();

      (el(`[data-company="${SEARA.id}"] [data-testid="equipamentos"]`) as HTMLElement).click();
      await harness.fixture.whenStable();

      expect(TestBed.inject(Router).url).toBe(`/app/empresas/${SEARA.id}/painel`);
    });

    it('não deve entrar na empresa quando o clique é numa ação da linha', async () => {
      await comoJosué();
      await abrir();

      el(`[data-company="${BRF.id}"] [data-testid="acao-desativar"] button`)!.click();
      harness.detectChanges();
      await harness.fixture.whenStable();

      expect(TestBed.inject(Router).url).toBe('/app/empresas');
    });
  });

  describe('o que se oferece', () => {
    it('deve oferecer cadastrar a quem pode', async () => {
      await comoCarla();
      await abrir();

      expect(el('[data-testid="nova-empresa"]')).not.toBeNull();
    });

    it('não deve oferecer cadastrar ao Técnico', async () => {
      await comoFernando();
      await abrir('/app/empresas', [linhaDeEmpresa({ actions: NADA })]);

      expect(el('[data-testid="nova-empresa"]')).toBeNull();
    });

    it('deve deixar o titular sem vínculo nenhum cadastrar a primeira empresa', async () => {
      await entrarComo([], true);
      await abrir('/app/empresas', []);

      expect(el('[data-testid="nova-empresa-vazio"]')).not.toBeNull();
    });

    it('deve mostrar só as ações que o servidor ofereceu — ao Técnico, só ver', async () => {
      await comoFernando();
      await abrir('/app/empresas', [linhaDeEmpresa({ actions: NADA })]);

      expect(el('[data-testid="acao-ver"]')).not.toBeNull();
      expect(el('[data-testid="acao-editar"]')).toBeNull();
      expect(el('[data-testid="acao-desativar"]')).toBeNull();
    });

    it('deve abrir a prévia da empresa sem entrar nela — para todos, inclusive o Técnico', async () => {
      await comoFernando();
      await abrir('/app/empresas', [linhaDeEmpresa({ actions: NADA })]);

      el(`[data-company="${BRF.id}"] [data-testid="acao-ver"] button`)!.click();
      harness.detectChanges();

      http.expectOne(`${API}/companies/${BRF.id}`).flush(perfilDaBrf());
      harness.detectChanges();
      expect(document.body.textContent).toContain('Rua Senador Atílio Fontana, 86');
      expect(TestBed.inject(Router).url).toBe('/app/empresas');
    });

    it('deve levar à edição fora do contexto da empresa', async () => {
      await comoJosué();
      await abrir();

      const editar = el(`[data-company="${BRF.id}"] [data-testid="acao-editar"] a`) as HTMLAnchorElement;
      expect(editar.getAttribute('href')).toBe(`/app/empresas/${BRF.id}/editar`);
    });

    it('deve pedir confirmação antes de desativar, dizendo que a empresa fica em modo leitura', async () => {
      await comoJosué();
      await abrir();

      el(`[data-company="${BRF.id}"] [data-testid="acao-desativar"] button`)!.click();
      harness.detectChanges();

      expect(document.body.textContent).toContain('modo leitura');
      http.expectNone(`${API}/companies/${BRF.id}/deactivate`);

      (document.querySelector('[data-testid="confirmar-desativar"] button') as HTMLElement).click();
      http.expectOne(`${API}/companies/${BRF.id}/deactivate`).flush(null);
      http.expectOne((r) => r.url === `${API}/companies`).flush(CARTEIRA);
    });

    it('deve reativar sem cerimônia — reativar não tira nada de ninguém', async () => {
      await comoJosué();
      await abrir('/app/empresas?status=INACTIVE', [
        linhaDeEmpresa({ status: 'INACTIVE', actions: { edit: false, deactivate: false, reactivate: true } }),
      ]);

      el('[data-testid="acao-reativar"] button')!.click();
      http.expectOne(`${API}/companies/${BRF.id}/reactivate`).flush(null);
      http.expectOne((r) => r.url === `${API}/companies`).flush([]);
    });
  });

  describe('busca e filtro', () => {
    it('deve buscar no servidor e guardar o termo na URL', async () => {
      await comoJosué();
      await abrir();

      const busca = el('[data-testid="busca"]') as HTMLInputElement;
      busca.value = 'concórdia';
      busca.dispatchEvent(new Event('input'));
      await esperar(400);

      const req = http.expectOne((r) => r.url === `${API}/companies`);
      expect(req.request.params.get('q')).toBe('concórdia');
      req.flush([linhaDeEmpresa()]);
      expect(TestBed.inject(Router).url).toContain('q=conc');
    });

    it('deve abrir já filtrada quando a URL traz a busca — o "voltar" encontra a lista como estava', async () => {
      await comoJosué();
      harness = await RouterTestingHarness.create();
      await harness.navigateByUrl('/app/empresas?q=seara&status=ALL', CompaniesComponent);

      const req = http.expectOne((r) => r.url === `${API}/companies`);
      expect(req.request.params.get('q')).toBe('seara');
      expect(req.request.params.get('status')).toBe('ALL');
      req.flush([]);
      harness.detectChanges();

      expect((el('[data-testid="busca"]') as HTMLInputElement).value).toBe('seara');
    });

    it('deve filtrar por status', async () => {
      await comoJosué();
      await abrir();

      escolher(harness.fixture, 'filtro-status', 'Inativa');
      await harness.fixture.whenStable();

      const req = http.expectOne((r) => r.url === `${API}/companies`);
      expect(req.request.params.get('status')).toBe('INACTIVE');
      req.flush([]);
    });

    it('não deve confundir carteira vazia com busca sem resultado', async () => {
      await comoJosué();
      await abrir('/app/empresas', []);
      expect(texto()).toContain('Nenhuma empresa na sua carteira');

      await harness.navigateByUrl('/app/empresas?q=zzz');
      http.expectOne((r) => r.url === `${API}/companies`).flush([]);
      harness.detectChanges();
      expect(texto()).toContain('Nenhuma empresa encontrada');
      expect(el('[data-testid="nova-empresa-vazio"]')).toBeNull();
    });
  });
});
