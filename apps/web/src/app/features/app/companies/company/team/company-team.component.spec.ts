import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { ComponentFixture, TestBed } from '@angular/core/testing';
import { ActivatedRoute, convertToParamMap, provideRouter } from '@angular/router';
import { of } from 'rxjs';
import { firstValueFrom } from 'rxjs';

import type { CompanyMember, MembershipWithCompany } from '@normatiza/shared';

import { API_BASE_URL } from '../../../../../core/auth/api.config';
import { AuthService } from '../../../../../core/auth/auth.service';
import {
  BRF,
  SEARA,
  respostaDeLogin,
  sessão,
  vínculo,
} from '../../../../../core/auth/testing/sessao';
import {
  EQUIPE_DA_BRF,
  carlaNaBrf,
  terceiroNaBrf,
} from '../../../../../core/services/testing/equipe';
import { CompanyTeamComponent } from './company-team.component';

/**
 * Equipe da Empresa — Contexto 2.
 *
 * Esta tela tem uma responsabilidade que a do Contexto 1 não tem: **não contar
 * demais**. O Marcos administra a BRF por aqui e não pode sair sabendo que a
 * mesma consultoria atende a Seara, nem que existe uma conta acima da empresa
 * dele. É por isso que a projeção é outra, e não a lista da conta filtrada.
 */
describe('CompanyTeamComponent', () => {
  let fixture: ComponentFixture<CompanyTeamComponent>;
  let http: HttpTestingController;

  const API = 'http://api.teste';

  beforeEach(() => {
    TestBed.configureTestingModule({
      imports: [CompanyTeamComponent],
      providers: [
        provideRouter([]),
        provideHttpClient(),
        provideHttpClientTesting(),
        { provide: API_BASE_URL, useValue: API },
        {
          provide: ActivatedRoute,
          useValue: {
            paramMap: of(convertToParamMap({ companyId: BRF.id })),
            snapshot: { paramMap: convertToParamMap({ companyId: BRF.id }) },
          },
        },
      ],
    });
    http = TestBed.inject(HttpTestingController);
  });

  afterEach(() => http.verify());

  async function abrirComo(
    memberships: MembershipWithCompany[],
    equipe: CompanyMember[] = EQUIPE_DA_BRF,
  ): Promise<void> {
    const auth = TestBed.inject(AuthService);
    const login = firstValueFrom(auth.login({ email: 'quem@seja.com', password: 'certa' }));
    http.expectOne(`${API}/auth/login`).flush(respostaDeLogin({ session: sessão(memberships) }));
    await login;

    fixture = TestBed.createComponent(CompanyTeamComponent);
    fixture.detectChanges();
    http.expectOne(`${API}/companies/${BRF.id}/members`).flush(equipe);
    fixture.detectChanges();
  }

  const comoMarcos = (equipe?: CompanyMember[]) =>
    abrirComo([vínculo(BRF.id, ['MANAGER'])], equipe);

  const comoJosué = (equipe?: CompanyMember[]) =>
    abrirComo([vínculo(BRF.id, ['LEAD_ENGINEER']), vínculo(SEARA.id, ['LEAD_ENGINEER'])], equipe);

  const texto = () => (fixture.nativeElement as HTMLElement).textContent ?? '';
  const el = (seletor: string) =>
    (fixture.nativeElement as HTMLElement).querySelector(seletor) as HTMLElement | null;
  const todos = (seletor: string) =>
    Array.from((fixture.nativeElement as HTMLElement).querySelectorAll(seletor)) as HTMLElement[];
  const linhaDe = (userId: string) => el(`[data-testid="linha"][data-user="${userId}"]`);

  function clicar(elemento: HTMLElement | null) {
    elemento!.click();
    fixture.detectChanges();
  }

  describe('a lista', () => {
    it('deve mostrar quem tem acesso a esta empresa', async () => {
      await comoMarcos();

      expect(todos('[data-testid="linha"]').length).toBe(EQUIPE_DA_BRF.length);
    });

    it('deve separar consultoria, cliente e terceiro na coluna de origem', async () => {
      // Três relações contratuais diferentes. Quem administra a planta precisa
      // distinguir o funcionário dele do terceiro contratado e de quem vem da
      // consultoria — as expectativas sobre quem manda em quem não são iguais.
      await comoMarcos();

      expect(linhaDe(carlaNaBrf.id)!.textContent).toContain('Consultoria');
      expect(linhaDe(terceiroNaBrf.id)!.textContent).toContain('Terceiro');
    });

    it('não deve nomear nenhuma outra empresa', async () => {
      await comoMarcos();

      expect(texto()).toContain('Carla');
      expect(texto()).not.toContain('Seara');
      expect(texto()).not.toContain(SEARA.id);
    });
  });

  describe('o que esta tela não pratica', () => {
    it('não deve oferecer desligamento da conta a ninguém', async () => {
      // D8: o Marcos tira alguém da BRF; ele não apaga essa pessoa da
      // Normatiza. A separação precisa estar na tela, não só no servidor.
      await comoMarcos();

      // A remoção existe e está à vista; o desligamento não. É a diferença que
      // precisa aparecer, e não a ausência de tudo.
      expect(linhaDe(terceiroNaBrf.id)!.querySelector('[data-testid="acao-remover"]')).not.toBeNull();
      expect(el('[data-testid="acao-desligar"]')).toBeNull();
      expect(texto()).not.toContain('Desligar da conta');
    });

    it('deve chamar a remoção pelo que ela é: sair da empresa', async () => {
      // "Excluir" faria o Gestor pensar que apagou a pessoa. Ele encerrou o
      // acesso dela a **esta** empresa, e o cadastro segue existindo.
      await comoMarcos();

      const botão = linhaDe(terceiroNaBrf.id)!.querySelector(
        '[data-testid="acao-remover"]',
      ) as HTMLElement;
      expect(botão.textContent).toContain('Remover da empresa');
      expect(botão.textContent).not.toContain('Excluir');
    });

    it('deve remover desativando o vínculo desta empresa', async () => {
      await comoMarcos();

      clicar(linhaDe(terceiroNaBrf.id)!.querySelector('[data-testid="acao-remover"]'));
      clicar(el('[data-testid="confirmar-remocao"]'));

      const req = http.expectOne(`${API}/memberships/${terceiroNaBrf.membershipId}`);
      expect(req.request.method).toBe('DELETE');
      req.flush(null);
      fixture.detectChanges();

      http.expectOne(`${API}/companies/${BRF.id}/members`).flush(EQUIPE_DA_BRF);
    });

    it('não deve deixar o cliente gerenciar quem é da consultoria', async () => {
      // A Carla aparece na lista — o Marcos precisa saber quem o atende. Mas
      // ela não é dele para remover. As `actions` do servidor dizem isso, e a
      // tela só obedece.
      await comoMarcos();

      expect(linhaDe(carlaNaBrf.id)!.querySelector('[data-testid="acao-remover"]')).toBeNull();
      expect(linhaDe(carlaNaBrf.id)!.querySelector('[data-testid="acao-trocar-papel"]')).toBeNull();
    });
  });

  describe('o convite', () => {
    it('não deve perguntar em qual empresa — já se sabe qual', async () => {
      await comoMarcos();

      clicar(el('[data-testid="convidar"]'));

      expect(el('[data-testid="convite-papel"]')).not.toBeNull();
      expect(el('[data-testid="empresa-oferecida"]')).toBeNull();
    });

    it('deve convidar para esta empresa, sem que ninguém escolha', async () => {
      await comoMarcos();

      clicar(el('[data-testid="convidar"]'));
      preencher('novo@brf.com', 'Novo');
      escolherPapel('EXECUTOR');
      clicar(el('[data-testid="enviar-convite"]'));

      const req = http.expectOne(`${API}/invitations`);
      expect(req.request.body.companyIds).toEqual([BRF.id]);
      req.flush({ id: 'inv-novo' });
      fixture.detectChanges();

      http.expectOne(`${API}/companies/${BRF.id}/members`).flush(EQUIPE_DA_BRF);
    });

    it('deve oferecer ao Gestor apenas os papéis que ele concede', async () => {
      await comoMarcos();

      clicar(el('[data-testid="convidar"]'));

      const oferecidos = todos('[data-testid="papel-oferecido"]').map(
        (o) => (o as HTMLOptionElement).value,
      );
      expect(oferecidos.sort()).toEqual(['CLIENT_ENGINEER', 'DIRECTOR', 'EXECUTOR']);
    });

    it('deve oferecer à consultoria, dentro da empresa, a alçada maior dela', async () => {
      // A mesma tela, outro olhar: o Engenheiro Responsável entra na empresa e
      // continua podendo alocar gente da consultoria nela.
      await comoJosué();

      clicar(el('[data-testid="convidar"]'));

      const oferecidos = todos('[data-testid="papel-oferecido"]').map(
        (o) => (o as HTMLOptionElement).value,
      );
      expect(oferecidos).toContain('TECHNICIAN');
      expect(oferecidos).toContain('MANAGER');
    });
  });

  function preencher(email: string, nome: string) {
    const campoEmail = el('[data-testid="convite-email"]') as HTMLInputElement;
    const campoNome = el('[data-testid="convite-nome"]') as HTMLInputElement;
    campoEmail.value = email;
    campoEmail.dispatchEvent(new Event('input'));
    campoNome.value = nome;
    campoNome.dispatchEvent(new Event('input'));
    fixture.detectChanges();
  }

  function escolherPapel(papel: string) {
    const seleção = el('[data-testid="convite-papel"]') as HTMLSelectElement;
    seleção.value = papel;
    seleção.dispatchEvent(new Event('change'));
    fixture.detectChanges();
  }
});
