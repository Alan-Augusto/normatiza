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
import {
  clicar as clicarNo,
  digitar as digitarEm,
  elemento,
  elementos,
  escolher,
  opcoesDe,
} from '../../../../../core/testing/prime';
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
  const el = (seletor: string) => elemento(fixture, seletor);
  const todos = (seletor: string) => elementos(fixture, seletor);
  const linhaDe = (userId: string) => el(`[data-testid="linha"][data-user="${userId}"]`);

  function clicar(alvo: HTMLElement | null) {
    alvo!.click();
    fixture.detectChanges();
  }

  /** A ação de uma linha: o `<button>` real mora dentro do `p-button`. */
  function acao(userId: string, nome: string): HTMLElement {
    const botao = linhaDe(userId)!.querySelector(`[data-testid="acao-${nome}"] button`);
    if (!botao) throw new Error(`"${nome}" não é oferecido na linha de ${userId}.`);
    return botao as HTMLElement;
  }

  const temAcao = (userId: string, nome: string) =>
    linhaDe(userId)!.querySelector(`[data-testid="acao-${nome}"]`) !== null;

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
      expect(temAcao(terceiroNaBrf.id, 'remover')).toBe(true);
      expect(el('[data-testid="acao-desligar"]')).toBeNull();
      expect(texto()).not.toContain('Desligar da conta');
    });

    it('deve chamar a remoção pelo que ela é: sair da empresa', async () => {
      // "Excluir" faria o Gestor pensar que apagou a pessoa. Ele encerrou o
      // acesso dela a **esta** empresa, e o cadastro segue existindo.
      await comoMarcos();

      const botão = acao(terceiroNaBrf.id, 'remover');
      expect(botão.textContent).toContain('Remover da empresa');
      expect(botão.textContent).not.toContain('Excluir');
    });

    it('deve remover desativando o vínculo desta empresa', async () => {
      await comoMarcos();

      clicar(acao(terceiroNaBrf.id, 'remover'));
      clicarNo(fixture, '[data-testid="confirmar-remocao"] button');

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

      expect(temAcao(carlaNaBrf.id, 'remover')).toBe(false);
      expect(temAcao(carlaNaBrf.id, 'trocar-papel')).toBe(false);
    });
  });

  describe('o convite', () => {
    it('não deve perguntar em qual empresa — já se sabe qual', async () => {
      await comoMarcos();

      clicarNo(fixture, '[data-testid="convidar"] button');

      expect(el('[data-testid="convite-papel"]')).not.toBeNull();
      expect(el('[data-testid="empresa-oferecida"]')).toBeNull();
    });

    it('deve convidar para esta empresa, sem que ninguém escolha', async () => {
      await comoMarcos();

      clicarNo(fixture, '[data-testid="convidar"] button');
      preencher('novo@brf.com', 'Novo');
      escolher(fixture, 'convite-papel', 'Executor');
      clicarNo(fixture, '[data-testid="enviar-convite"] button');

      const req = http.expectOne(`${API}/invitations`);
      expect(req.request.body.companyIds).toEqual([BRF.id]);
      req.flush({ id: 'inv-novo' });
      fixture.detectChanges();

      http.expectOne(`${API}/companies/${BRF.id}/members`).flush(EQUIPE_DA_BRF);
    });

    it('deve oferecer ao Gestor apenas os papéis que ele concede', async () => {
      await comoMarcos();

      clicarNo(fixture, '[data-testid="convidar"] button');

      expect(opcoesDe(fixture, 'convite-papel').sort()).toEqual([
        'Diretor',
        'Engenheiro do Cliente',
        'Executor',
      ]);
    });

    it('não deve oferecer convite ao Diretor, que não concede papel nenhum', async () => {
      // `CAN_INVITE.DIRECTOR` é vazio — a Débora acompanha, não administra.
      await abrirComo([vínculo(BRF.id, ['DIRECTOR'])]);

      expect(el('[data-testid="convidar"]')).toBeNull();
      // Mas ela continua vendo quem tem acesso à empresa dela: numa ferramenta
      // de conformidade, essa lista é material de auditoria.
      expect(todos('[data-testid="linha"]').length).toBe(EQUIPE_DA_BRF.length);
    });

    it('deve oferecer à consultoria, dentro da empresa, a alçada maior dela', async () => {
      // A mesma tela, outro olhar: o Engenheiro Responsável entra na empresa e
      // continua podendo alocar gente da consultoria nela.
      await comoJosué();

      clicarNo(fixture, '[data-testid="convidar"] button');

      const oferecidos = opcoesDe(fixture, 'convite-papel');
      expect(oferecidos).toContain('Técnico');
      expect(oferecidos).toContain('Gestor');
    });
  });

  function preencher(email: string, nome: string) {
    digitarEm(fixture, '[data-testid="convite-email"]', email);
    digitarEm(fixture, '[data-testid="convite-nome"]', nome);
  }
});
