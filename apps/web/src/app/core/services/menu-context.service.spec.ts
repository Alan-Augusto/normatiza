import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { TestBed } from '@angular/core/testing';
import { NavigationEnd, Router } from '@angular/router';
import { firstValueFrom, of } from 'rxjs';

import type { Role } from '@normatiza/shared';

import { API_BASE_URL } from '../auth/api.config';
import { AuthService } from '../auth/auth.service';
import { BRF, respostaDeLogin, sessão, vínculo } from '../auth/testing/sessao';
import { MenuContextService } from './menu-context.service';

/**
 * O menu lateral é a âncora que diz em qual universo a pessoa está atuando
 * ([03 §1](../../../../../docs/produto/03_navegacao_e_telas.md)). Um menu que
 * mostra o universo errado não é só feio: revela ao cliente que existe uma
 * camada de consultoria acima da empresa dele.
 */
describe('MenuContextService', () => {
  let http: HttpTestingController;

  const API = 'http://api.teste';
  const DENTRO_DA_EMPRESA = `/app/companies/${BRF.id}/dashboard`;

  async function menuEm(url: string, papéis: Role[], isPlatformAdmin = false, éDono = false) {
    TestBed.resetTestingModule();
    TestBed.configureTestingModule({
      providers: [
        provideHttpClient(),
        provideHttpClientTesting(),
        { provide: API_BASE_URL, useValue: API },
        { provide: Router, useValue: { url, events: of(new NavigationEnd(1, url, url)) } },
      ],
    });

    http = TestBed.inject(HttpTestingController);
    const auth = TestBed.inject(AuthService);

    const vínculos = papéis.length > 0 ? [vínculo(BRF.id, papéis)] : [];
    const promessa = firstValueFrom(auth.login({ email: 'x@y.com', password: 'z' }));
    http
      .expectOne(`${API}/auth/login`)
      .flush(respostaDeLogin({ session: sessão(vínculos, isPlatformAdmin, éDono) }));
    await promessa;

    return TestBed.inject(MenuContextService).context();
  }

  const rótulos = (ctx: { items: { label: string }[] }) => ctx.items.map((i) => i.label);

  afterEach(() => http.verify());

  describe('Contexto 2 — dentro da empresa', () => {
    it('deve oferecer a volta para a carteira a quem é da consultoria', async () => {
      const ctx = await menuEm(DENTRO_DA_EMPRESA, ['CONSULTANT_ENGINEER']);

      expect(ctx.backLink?.route).toBe('/app/companies');
      expect(ctx.breadcrumbs[0].label).toBe('Empresas');
    });

    it('não deve oferecer a volta para a carteira ao lado cliente', async () => {
      const ctx = await menuEm(DENTRO_DA_EMPRESA, ['MANAGER']);
      expect(ctx.backLink).toBeUndefined();
    });

    it('não deve mostrar "Empresas" nas migalhas do lado cliente', async () => {
      const ctx = await menuEm(DENTRO_DA_EMPRESA, ['MANAGER']);
      expect(ctx.breadcrumbs.map((b) => b.label)).not.toContain('Empresas');
    });

    it('deve manter o menu da empresa igual para os dois lados', async () => {
      // O que muda é só a saída para cima. Dentro da empresa, cliente e
      // consultoria navegam nas mesmas telas.
      const cliente = await menuEm(DENTRO_DA_EMPRESA, ['MANAGER']);
      const consultoria = await menuEm(DENTRO_DA_EMPRESA, ['CONSULTANT_ENGINEER']);

      expect(cliente.items.map((i) => i.route)).toEqual(consultoria.items.map((i) => i.route));
    });
  });

  describe('Configurações — transversal', () => {
    it('deve montar o próprio contexto, e não o da consultoria', async () => {
      // Era aqui que vazava: `/app/profile` não era reconhecido e caía no menu
      // do Contexto 1, com Empresas e Meus Cadastros à vista do cliente.
      const ctx = await menuEm('/app/profile', ['CLIENT_ENGINEER']);

      expect(ctx.level).toBe('settings');
      expect(rótulos(ctx)).not.toContain('Empresas');
      expect(rótulos(ctx)).not.toContain('Meus Cadastros');
      expect(rótulos(ctx)).toContain('Meu Perfil');
    });

    it('deve valer igual para quem é da consultoria', async () => {
      const ctx = await menuEm('/app/profile', ['LEAD_ENGINEER']);
      expect(ctx.level).toBe('settings');
    });

    it('deve oferecer uma saída de volta ao contexto de quem entrou', async () => {
      // Sem isto, o único jeito de sair das configurações é clicar num item de
      // menu que a pessoa nem deveria estar vendo.
      const cliente = await menuEm('/app/profile', ['MANAGER']);
      expect(cliente.backLink?.route).toBe(`/app/companies/${BRF.id}/dashboard`);

      const consultoria = await menuEm('/app/profile', ['LEAD_ENGINEER']);
      expect(consultoria.backLink?.route).toBe('/app/dashboard');
    });

    it('deve levar o admin da plataforma de volta ao backoffice', async () => {
      const ctx = await menuEm('/app/profile', [], true);
      expect(ctx.backLink?.route).toBe('/admin');
    });

    it('deve oferecer Plano / Créditos ao titular da conta', async () => {
      const ctx = await menuEm('/app/profile', ['LEAD_ENGINEER'], false, true);
      expect(rótulos(ctx)).toContain('Plano / Créditos');
    });

    it('não deve oferecer Plano / Créditos a quem não titulariza a conta', async () => {
      // A conta é a unidade de faturamento ([01 §5]): quem contrata é a
      // consultoria, e quem responde por ela é o titular. O Gestor da BRF é
      // funcionário do cliente — o plano da Normatiza não é assunto dele.
      const gestor = await menuEm('/app/profile', ['MANAGER'], false, false);
      expect(rótulos(gestor)).not.toContain('Plano / Créditos');

      const engenheiroSemTitularidade = await menuEm(
        '/app/profile',
        ['CONSULTANT_ENGINEER'],
        false,
        false,
      );
      expect(rótulos(engenheiroSemTitularidade)).not.toContain('Plano / Créditos');
    });

    it('deve manter Meu Perfil para todos', async () => {
      const ctx = await menuEm('/app/profile', ['EXECUTOR']);
      expect(rótulos(ctx)).toContain('Meu Perfil');
    });
  });

  describe('Área de Execução', () => {
    it('deve reconhecer a rota da execução', async () => {
      // O serviço procurava `/app/my-tasks`, mas a rota é `/app/execution`:
      // o ramo estava morto e o Executor recebia o menu da consultoria.
      const ctx = await menuEm('/app/execution', ['EXECUTOR']);

      expect(ctx.level).toBe('execution');
      expect(rótulos(ctx)).not.toContain('Empresas');
    });
  });

  describe('o menu do Contexto 1 é só de quem tem carteira', () => {
    it('deve montá-lo para a consultoria', async () => {
      const ctx = await menuEm('/app/dashboard', ['TECHNICIAN']);
      expect(rótulos(ctx)).toContain('Empresas');
    });

    it('não deve montá-lo para o lado cliente, em nenhuma URL', async () => {
      // A rede de segurança: qualquer rota que o serviço não reconheça deixa de
      // cair no menu privilegiado. Sem isso, cada tela nova é uma chance de
      // vazar de novo — foi assim com o perfil e com a execução.
      const ctx = await menuEm('/app/rota-que-ainda-nao-existe', ['MANAGER']);

      expect(rótulos(ctx)).not.toContain('Empresas');
      expect(rótulos(ctx)).not.toContain('Meus Cadastros');
    });

    it('deve cair no contexto da própria pessoa quando a URL é desconhecida', async () => {
      const ctx = await menuEm('/app/rota-que-ainda-nao-existe', ['EXECUTOR']);
      expect(ctx.level).toBe('execution');
    });
  });
});
