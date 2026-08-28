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

  const texto = () => (fixture.nativeElement as HTMLElement).textContent ?? '';
  const el = (seletor: string) =>
    (fixture.nativeElement as HTMLElement).querySelector(seletor) as HTMLElement | null;
  const todos = (seletor: string) =>
    Array.from((fixture.nativeElement as HTMLElement).querySelectorAll(seletor)) as HTMLElement[];

  /** A linha de uma pessoa, pelo id — a tabela é lida como quem olha a lê. */
  const linhaDe = (userId: string) => el(`[data-testid="linha"][data-user="${userId}"]`);

  function clicar(elemento: HTMLElement | null) {
    elemento!.click();
    fixture.detectChanges();
  }

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
      expect(linha.querySelector('[data-testid="acao-reenviar"]')).not.toBeNull();
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

      const filtro = el('[data-testid="filtro-papel"]') as HTMLSelectElement;
      filtro.value = 'MANAGER';
      filtro.dispatchEvent(new Event('change'));
      fixture.detectChanges();

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

      expect(linhaDe(marcos.id)!.querySelector('[data-testid="acao-trocar-papel"]')).not.toBeNull();
      expect(linhaDe(desligado.id)!.querySelector('[data-testid="acao-trocar-papel"]')).toBeNull();
    });

    it('não deve oferecer o desligamento do titular da conta', async () => {
      // D12: não é botão desabilitado com aviso — é ação que não existe, porque
      // não há caminho para ela.
      await comoJosué();

      expect(linhaDe(josué.id)!.querySelector('[data-testid="acao-desligar"]')).toBeNull();
    });

    it('deve oferecer reenvio e revogação só a quem tem convite aberto', async () => {
      await comoJosué();

      expect(linhaDe(rafael.id)!.querySelector('[data-testid="acao-reenviar"]')).not.toBeNull();
      expect(linhaDe(rafael.id)!.querySelector('[data-testid="acao-revogar"]')).not.toBeNull();
      expect(linhaDe(carla.id)!.querySelector('[data-testid="acao-reenviar"]')).toBeNull();
    });

    it('deve reenviar o convite pelo id do convite', async () => {
      await comoJosué();

      clicar(linhaDe(rafael.id)!.querySelector('[data-testid="acao-reenviar"]') as HTMLElement);

      http.expectOne(`${API}/invitations/${rafael.invitation!.id}/resend`).flush(null);
    });
  });

  describe('o convite', () => {
    it('deve oferecer à Carla apenas o papel que ela pode conceder', async () => {
      // A alçada da Engenheira da Consultoria termina no Técnico. Mostrar
      // "Gestor" numa lista que o servidor vai recusar é convidar ao erro.
      await comoCarla();

      clicar(el('[data-testid="convidar"]'));

      const oferecidos = todos('[data-testid="papel-oferecido"]').map((o) =>
        (o as HTMLOptionElement).value,
      );
      expect(oferecidos).toEqual(['TECHNICIAN']);
    });

    it('deve oferecer ao Engenheiro Responsável a lista inteira que ele alcança', async () => {
      await comoJosué();

      clicar(el('[data-testid="convidar"]'));

      const oferecidos = todos('[data-testid="papel-oferecido"]').map((o) =>
        (o as HTMLOptionElement).value,
      );
      expect(oferecidos).toContain('MANAGER');
      expect(oferecidos).toContain('EXECUTOR');
      expect(oferecidos).not.toContain('LEAD_ENGINEER');
    });

    it('deve oferecer como escopo apenas as empresas de quem convida', async () => {
      // O teto de escopo é a carteira de quem convida. A Carla não põe ninguém
      // numa empresa que ela mesma não atende.
      await comoCarla();

      clicar(el('[data-testid="convidar"]'));

      const empresas = todos('[data-testid="empresa-oferecida"]').map((o) =>
        (o as HTMLOptionElement).value,
      );
      expect(empresas).toEqual([BRF.id]);
    });
  });

  describe('a troca de papel', () => {
    it('deve declarar o conjunto final de papéis do vínculo', async () => {
      await comoJosué();

      clicar(linhaDe(marcos.id)!.querySelector('[data-testid="acao-trocar-papel"]') as HTMLElement);
      marcar('DIRECTOR');
      clicar(el('[data-testid="salvar-papeis"]'));

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

      clicar(
        linhaDe(fernando.id)!.querySelector('[data-testid="acao-trocar-papel"]') as HTMLElement,
      );
      marcar('MANAGER');
      fixture.detectChanges();

      const aviso = el('[data-testid="conflito-de-papel"]');
      expect(aviso).not.toBeNull();
      expect(aviso!.textContent).toContain('Seara');
      expect((el('[data-testid="salvar-papeis"]') as HTMLButtonElement).disabled).toBe(true);

      http.expectNone((r) => r.method === 'PATCH');
    });

    it('não deve reclamar de conflito quando o papel de empresa é da mesma empresa', async () => {
      // O Marcos já é Gestor da BRF. Acrescentar Diretor no mesmo vínculo não
      // esbarra em nada — avisar aqui seria burocracia inventada.
      await comoJosué();

      clicar(linhaDe(marcos.id)!.querySelector('[data-testid="acao-trocar-papel"]') as HTMLElement);
      marcar('DIRECTOR');
      fixture.detectChanges();

      expect(el('[data-testid="conflito-de-papel"]')).toBeNull();
      expect((el('[data-testid="salvar-papeis"]') as HTMLButtonElement).disabled).toBe(false);
    });
  });

  describe('o desligamento', () => {
    it('deve consultar o que a saída quebra antes de perguntar qualquer coisa', async () => {
      await comoJosué();

      clicar(linhaDe(carla.id)!.querySelector('[data-testid="acao-desligar"]') as HTMLElement);

      http.expectOne(`${API}/users/${carla.id}/disable-preview`).flush(prévia());
      fixture.detectChanges();

      expect(el('[data-testid="escolher-sucessor"]')).toBeNull();
      expect(el('[data-testid="confirmar-desligamento"]')).not.toBeNull();
    });

    it('deve pedir sucessor quando a saída deixa uma empresa sem quem responda', async () => {
      await comoJosué();

      clicar(linhaDe(marcos.id)!.querySelector('[data-testid="acao-desligar"]') as HTMLElement);

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
      expect((el('[data-testid="confirmar-desligamento"]') as HTMLButtonElement).disabled).toBe(
        true,
      );
    });

    it('deve enviar o sucessor escolhido junto do desligamento', async () => {
      await comoJosué();

      clicar(linhaDe(marcos.id)!.querySelector('[data-testid="acao-desligar"]') as HTMLElement);
      http.expectOne(`${API}/users/${marcos.id}/disable-preview`).flush(
        prévia({
          requiresSuccessor: true,
          successorReasons: ['Único Gestor da BRF.'],
          eligibleSuccessors: [{ id: fernando.id, name: 'Fernando' }],
        }),
      );
      fixture.detectChanges();

      const escolha = el('[data-testid="escolher-sucessor"]') as HTMLSelectElement;
      escolha.value = fernando.id;
      escolha.dispatchEvent(new Event('change'));
      fixture.detectChanges();

      clicar(el('[data-testid="confirmar-desligamento"]'));

      const req = http.expectOne(`${API}/users/${marcos.id}/disable`);
      expect(req.request.body.successorUserId).toBe(fernando.id);
      req.flush(null);
      fixture.detectChanges();

      http.expectOne((r) => r.url === `${API}/users`).flush(EQUIPE);
    });

    it('deve explicar quando o servidor recusa o desligamento', async () => {
      await comoJosué();

      clicar(linhaDe(carla.id)!.querySelector('[data-testid="acao-desligar"]') as HTMLElement);

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
    const caixa = el(`[data-testid="papel"][value="${papel}"]`) as HTMLInputElement;
    caixa.checked = true;
    caixa.dispatchEvent(new Event('change'));
    fixture.detectChanges();
  }
});
