import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { ComponentFixture, TestBed } from '@angular/core/testing';
import { provideRouter } from '@angular/router';
import { firstValueFrom } from 'rxjs';

import type { MembershipWithCompany, TeamMember } from '@normatiza/shared';

import { API_BASE_URL } from '../../../core/auth/api.config';
import { AuthService } from '../../../core/auth/auth.service';
import { BRF, SEARA, respostaDeLogin, sessão, vínculo } from '../../../core/auth/testing/sessao';
import {
  EQUIPE,
  carla,
  conviteExpirado,
  desligado,
  fernando,
  josué,
  marcos,
  prévia,
  rafael,
} from '../../../core/services/testing/equipe';
import {
  clicar as clicarNo,
  elemento,
  elementos,
  escolher,
  estaDesabilitado,
  marcar as marcarCaixa,
  opcoesDe,
} from '../../../core/testing/prime';
import { TeamComponent } from './team.component';

/**
 * Equipe — Contexto 1.
 *
 * A tela onde se vê quem tem acesso à conta, convida, troca de papel e desliga.
 * Três coisas ela não pode fazer, e são o que a maior parte destes testes
 * protege: oferecer um papel que o servidor vai recusar, oferecer um botão que
 * a alçada de quem olha não alcança, e deixar uma invariante do banco chegar
 * como erro de constraint na cara de quem usa.
 */
describe('TeamComponent', () => {
  let fixture: ComponentFixture<TeamComponent>;
  let http: HttpTestingController;

  const API = 'http://api.teste';

  beforeEach(() => {
    TestBed.configureTestingModule({
      imports: [TeamComponent],
      providers: [
        provideRouter([]),
        provideHttpClient(),
        provideHttpClientTesting(),
        { provide: API_BASE_URL, useValue: API },
      ],
    });
    http = TestBed.inject(HttpTestingController);
  });

  afterEach(() => http.verify());

  /** Entra como alguém e abre a tela já carregada. */
  async function abrirComo(
    memberships: MembershipWithCompany[],
    equipe: TeamMember[] = EQUIPE,
  ): Promise<void> {
    const auth = TestBed.inject(AuthService);
    const login = firstValueFrom(auth.login({ email: 'quem@seja.com', password: 'certa' }));
    http.expectOne(`${API}/auth/login`).flush(respostaDeLogin({ session: sessão(memberships) }));
    await login;

    fixture = TestBed.createComponent(TeamComponent);
    fixture.detectChanges();
    http.expectOne((r) => r.url === `${API}/users`).flush(equipe);
    fixture.detectChanges();
  }

  const comoJosué = (equipe?: TeamMember[]) =>
    abrirComo([vínculo(BRF.id, ['LEAD_ENGINEER']), vínculo(SEARA.id, ['LEAD_ENGINEER'])], equipe);

  const comoCarla = (equipe?: TeamMember[]) =>
    abrirComo([vínculo(BRF.id, ['CONSULTANT_ENGINEER'])], equipe);

  const comoTécnico = (equipe?: TeamMember[]) =>
    abrirComo([vínculo(BRF.id, ['TECHNICIAN'])], equipe);

  const texto = () => (fixture.nativeElement as HTMLElement).textContent ?? '';
  const el = (seletor: string) => elemento(fixture, seletor);
  const todos = (seletor: string) => elementos(fixture, seletor);

  /** A linha de uma pessoa, pelo id — a tabela é lida como quem olha a lê. */
  const linhaDe = (userId: string) => el(`[data-testid="linha"][data-user="${userId}"]`);

  function clicar(alvo: HTMLElement | null) {
    alvo!.click();
    fixture.detectChanges();
  }

  /** A ação de uma linha — os botões do PrimeNG são marcados no elemento externo. */
  function acao(userId: string, nome: string): HTMLElement {
    const botao = linhaDe(userId)!.querySelector(`[data-testid="acao-${nome}"] button`);
    if (!botao) throw new Error(`"${nome}" não é oferecido na linha de ${userId}.`);
    return botao as HTMLElement;
  }

  const temAcao = (userId: string, nome: string) =>
    linhaDe(userId)!.querySelector(`[data-testid="acao-${nome}"]`) !== null;

  describe('a lista', () => {
    it('deve mostrar quem tem acesso à conta', async () => {
      await comoJosué();

      expect(todos('[data-testid="linha"]').length).toBe(EQUIPE.length);
      expect(texto()).toContain('Carla');
      expect(texto()).toContain('Marcos');
    });

    it('deve dizer o papel de cada um pelo nome que o negócio usa', async () => {
      // "MANAGER" é como o banco chama; quem olha a tela chama de Gestor.
      await comoJosué();

      expect(linhaDe(marcos.id)!.textContent).toContain('Gestor');
      expect(linhaDe(marcos.id)!.textContent).not.toContain('MANAGER');
    });

    it('deve mostrar em que empresas a pessoa atua', async () => {
      await comoJosué();

      expect(linhaDe(josué.id)!.textContent).toContain('BRF');
      expect(linhaDe(josué.id)!.textContent).toContain('Seara');
    });

    it('deve dizer quem convidou', async () => {
      await comoJosué();

      expect(linhaDe(carla.id)!.textContent).toContain('Josué');
    });
  });

  describe('os estados que a tela mostra sem inventar', () => {
    it('deve mostrar quantos dias faltam para o convite pendente expirar', async () => {
      await comoJosué([rafael]);

      const linha = linhaDe(rafael.id)!;
      expect(linha.querySelector('[data-testid="convite-pendente"]')).not.toBeNull();
    });

    it('deve marcar como expirado o convite cuja data já passou, sem outro status', async () => {
      // "Expirado" não é status guardado: é `expiresAt` no passado. A tela
      // compara com o relógio, e o servidor continua dizendo apenas `INVITED`.
      await comoJosué([conviteExpirado]);

      const linha = linhaDe(conviteExpirado.id)!;
      expect(linha.querySelector('[data-testid="convite-expirado"]')).not.toBeNull();
      expect(temAcao(conviteExpirado.id, 'reenviar')).toBe(true);
    });

    it('deve dizer quem sucedeu quem foi desligado', async () => {
      // A linha não some (D6): quem auditar precisa achar o que era dela e para
      // quem foi.
      await comoJosué();

      const linha = linhaDe(desligado.id)!;
      expect(linha.textContent).toContain('Desligado');
      expect(linha.querySelector('[data-testid="sucessor"]')!.textContent).toContain('Marcos');
    });
  });

  describe('os filtros', () => {
    it('deve pedir ao servidor a lista filtrada por papel', async () => {
      await comoJosué();

      escolher(fixture, 'filtro-papel', 'Gestor');

      const req = http.expectOne((r) => r.url === `${API}/users`);
      expect(req.request.params.get('role')).toBe('MANAGER');
      req.flush([marcos]);
      fixture.detectChanges();

      expect(todos('[data-testid="linha"]').length).toBe(1);
    });

    it('deve oferecer filtro por empresa e por status', async () => {
      await comoJosué();

      expect(el('[data-testid="filtro-empresa"]')).not.toBeNull();
      expect(el('[data-testid="filtro-status"]')).not.toBeNull();
    });
  });

  describe('as ações de cada linha', () => {
    it('deve oferecer só o que a alçada de quem olha alcança', async () => {
      // `actions` vem do servidor por linha. A tela não recalcula — ela obedece.
      await comoJosué();

      expect(temAcao(marcos.id, 'trocar-papel')).toBe(true);
      expect(temAcao(desligado.id, 'trocar-papel')).toBe(false);
    });

    it('não deve oferecer o desligamento do titular da conta', async () => {
      // D12: não é botão desabilitado com aviso — é ação que não existe, porque
      // não há caminho para ela.
      await comoJosué();

      expect(temAcao(josué.id, 'desligar')).toBe(false);
    });

    it('deve oferecer reenvio e revogação só a quem tem convite aberto', async () => {
      await comoJosué();

      expect(temAcao(rafael.id, 'reenviar')).toBe(true);
      expect(temAcao(rafael.id, 'revogar')).toBe(true);
      expect(temAcao(carla.id, 'reenviar')).toBe(false);
    });

    it('deve reenviar o convite pelo id do convite', async () => {
      await comoJosué();

      clicar(acao(rafael.id, 'reenviar'));

      http.expectOne(`${API}/invitations/${rafael.invitation!.id}/resend`).flush(null);
    });
  });

  describe('o convite', () => {
    it('deve oferecer à Carla apenas o papel que ela pode conceder', async () => {
      // A alçada da Engenheira da Consultoria termina no Técnico. Mostrar
      // "Gestor" numa lista que o servidor vai recusar é convidar ao erro.
      await comoCarla();

      clicarNo(fixture, '[data-testid="convidar"] button');

      expect(opcoesDe(fixture, 'convite-papel')).toEqual(['Técnico']);
    });

    it('deve oferecer ao Engenheiro Responsável a lista inteira que ele alcança', async () => {
      await comoJosué();

      clicarNo(fixture, '[data-testid="convidar"] button');

      const oferecidos = opcoesDe(fixture, 'convite-papel');
      expect(oferecidos).toContain('Gestor');
      expect(oferecidos).toContain('Executor');
      expect(oferecidos).not.toContain('Engenheiro Responsável');
    });

    it('deve oferecer como escopo apenas as empresas de quem convida', async () => {
      // O teto de escopo é a carteira de quem convida. A Carla não põe ninguém
      // numa empresa que ela mesma não atende.
      await comoCarla();

      clicarNo(fixture, '[data-testid="convidar"] button');

      const empresas = todos('[data-testid="empresa-oferecida"]').map(
        (caixa) => caixa.parentElement?.textContent?.trim(),
      );
      expect(empresas).toEqual(['BRF']);
    });

    it('não deve oferecer convite a quem não concede papel nenhum', async () => {
      // `CAN_INVITE.TECHNICIAN` é vazio: o modal abriria sem uma única opção.
      // Oferecer a ação e recusá-la no passo seguinte é o mesmo gesto do botão
      // cinza — quem clica acha que o sistema quebrou.
      await comoTécnico();

      expect(el('[data-testid="convidar"]')).toBeNull();
    });

    it('deve continuar mostrando a equipe a quem não pode convidar', async () => {
      // Some o botão, não a tela. Saber quem é o Engenheiro Responsável não é
      // privilégio de quem administra, e a lista já vem recortada pelo escopo
      // de quem pergunta — o Técnico da BRF não enxerga ninguém da Seara.
      await comoTécnico();

      expect(todos('[data-testid="linha"]').length).toBe(EQUIPE.length);
    });
  });

  describe('a troca de papel', () => {
    it('deve declarar o conjunto final de papéis do vínculo', async () => {
      await comoJosué();

      clicar(acao(marcos.id, 'trocar-papel'));
      marcar('DIRECTOR');
      clicarNo(fixture, '[data-testid="salvar-papeis"] button');

      const req = http.expectOne(`${API}/memberships/${marcos.memberships[0].id}`);
      expect(req.request.body.roles).toEqual(expect.arrayContaining(['MANAGER', 'DIRECTOR']));
      req.flush(null);
      fixture.detectChanges();

      http.expectOne((r) => r.url === `${API}/users`).flush(EQUIPE);
    });

    it('deve explicar o conflito de papel de empresa antes de enviar', async () => {
      // Gestor, Engenheiro do Cliente e Diretor valem em uma empresa só. O
      // Fernando já é Diretor na Seara; promovê-lo a Gestor da BRF é recusado
      // pelo índice parcial do Postgres. Um erro de constraint chegando à tela
      // é falha de desenho — a tela avisa antes, e nem tenta.
      await comoJosué();

      clicar(acao(fernando.id, 'trocar-papel'));
      marcar('MANAGER');
      fixture.detectChanges();

      const aviso = el('[data-testid="conflito-de-papel"]');
      expect(aviso).not.toBeNull();
      expect(aviso!.textContent).toContain('Seara');
      expect(estaDesabilitado(fixture, '[data-testid="salvar-papeis"]')).toBe(true);

      http.expectNone((r) => r.method === 'PATCH');
    });

    it('não deve reclamar de conflito quando o papel de empresa é da mesma empresa', async () => {
      // O Marcos já é Gestor da BRF. Acrescentar Diretor no mesmo vínculo não
      // esbarra em nada — avisar aqui seria burocracia inventada.
      await comoJosué();

      clicar(acao(marcos.id, 'trocar-papel'));
      marcar('DIRECTOR');
      fixture.detectChanges();

      expect(el('[data-testid="conflito-de-papel"]')).toBeNull();
      expect(estaDesabilitado(fixture, '[data-testid="salvar-papeis"]')).toBe(false);
    });
  });

  describe('o desligamento', () => {
    it('deve consultar o que a saída quebra antes de perguntar qualquer coisa', async () => {
      await comoJosué();

      clicar(acao(carla.id, 'desligar'));

      http.expectOne(`${API}/users/${carla.id}/disable-preview`).flush(prévia());
      fixture.detectChanges();

      expect(el('[data-testid="escolher-sucessor"]')).toBeNull();
      expect(el('[data-testid="confirmar-desligamento"]')).not.toBeNull();
    });

    it('deve pedir sucessor quando a saída deixa uma empresa sem quem responda', async () => {
      await comoJosué();

      clicar(acao(marcos.id, 'desligar'));

      http.expectOne(`${API}/users/${marcos.id}/disable-preview`).flush(
        prévia({
          requiresSuccessor: true,
          successorReasons: ['Único Gestor da BRF.'],
          eligibleSuccessors: [{ id: fernando.id, name: 'Fernando' }],
        }),
      );
      fixture.detectChanges();

      // O motivo aparece escrito: quem decide precisa saber o que está herdando
      // para quem, e não só que "falta um campo".
      expect(texto()).toContain('Único Gestor da BRF.');
      expect(el('[data-testid="escolher-sucessor"]')).not.toBeNull();
      expect(estaDesabilitado(fixture, '[data-testid="confirmar-desligamento"]')).toBe(true);
    });

    it('deve enviar o sucessor escolhido junto do desligamento', async () => {
      await comoJosué();

      clicar(acao(marcos.id, 'desligar'));
      http.expectOne(`${API}/users/${marcos.id}/disable-preview`).flush(
        prévia({
          requiresSuccessor: true,
          successorReasons: ['Único Gestor da BRF.'],
          eligibleSuccessors: [{ id: fernando.id, name: 'Fernando' }],
        }),
      );
      fixture.detectChanges();

      escolher(fixture, 'escolher-sucessor', 'Fernando');
      clicarNo(fixture, '[data-testid="confirmar-desligamento"] button');

      const req = http.expectOne(`${API}/users/${marcos.id}/disable`);
      expect(req.request.body.successorUserId).toBe(fernando.id);
      req.flush(null);
      fixture.detectChanges();

      http.expectOne((r) => r.url === `${API}/users`).flush(EQUIPE);
    });

    it('deve explicar quando o servidor recusa o desligamento', async () => {
      await comoJosué();

      clicar(acao(carla.id, 'desligar'));

      http
        .expectOne(`${API}/users/${carla.id}/disable-preview`)
        .flush(prévia({ allowed: false, blockedReason: 'Só o lado consultoria desliga da conta.' }));
      fixture.detectChanges();

      expect(texto()).toContain('Só o lado consultoria desliga da conta.');
      expect(el('[data-testid="confirmar-desligamento"]')).toBeNull();
    });
  });

  /** Marca um papel na caixa de troca de papéis. */
  function marcar(papel: string) {
    marcarCaixa(fixture, `papel-${papel}`);
  }
});
