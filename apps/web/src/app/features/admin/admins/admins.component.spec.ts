import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { ComponentFixture, TestBed } from '@angular/core/testing';
import { provideRouter } from '@angular/router';
import { firstValueFrom } from 'rxjs';

import type { PlatformAdmin } from '@normatiza/shared';

import { API_BASE_URL } from '../../../core/auth/api.config';
import { AuthService } from '../../../core/auth/auth.service';
import { BRF, respostaDeLogin, sessão, vínculo } from '../../../core/auth/testing/sessao';
import { clicar, digitar, elemento, elementos } from '../../../core/testing/prime';
import { AdminsComponent } from './admins.component';

/**
 * Admins da Plataforma — Contexto 0.
 *
 * Ser admin não é papel de vínculo: é uma dimensão sobreposta ao login. Quem
 * está nesta lista continua sendo Engenheiro Responsável da consultoria dele —
 * e é por isso que a concessão precisa ser auditável, não um booleano.
 *
 * **O que ainda não é testado aqui:** conceder. A tela pedida em 5.4 concede
 * *por e-mail*, e a API de hoje concede por `userId` — não existe consulta de
 * pessoa que atravesse contas no Contexto 0. Está registrado como decisão
 * pendente no plano; testar um formulário cuja forma ainda não foi decidida
 * seria travar a decisão no teste.
 */
describe('AdminsComponent', () => {
  let fixture: ComponentFixture<AdminsComponent>;
  let http: HttpTestingController;

  const API = 'http://api.teste';

  /** O próprio — `sessão()` sempre entra como o usuário `u-1`. */
  const euMesmo: PlatformAdmin = {
    id: 'pa-1',
    userId: 'u-1',
    name: 'Josué',
    email: 'josue@normatiza.com',
    grantedAt: '2026-01-10T12:00:00.000Z',
  };

  const outro: PlatformAdmin = {
    id: 'pa-2',
    userId: 'u-2',
    name: 'Beatriz',
    email: 'beatriz@normatiza.com',
    grantedByUserId: 'u-1',
    grantedAt: '2026-05-02T12:00:00.000Z',
  };

  beforeEach(() => {
    TestBed.configureTestingModule({
      imports: [AdminsComponent],
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

  async function abrir(admins: PlatformAdmin[] = [euMesmo, outro]): Promise<void> {
    const auth = TestBed.inject(AuthService);
    const login = firstValueFrom(auth.login({ email: 'josue@normatiza.com', password: 'certa' }));
    http
      .expectOne(`${API}/auth/login`)
      .flush(respostaDeLogin({ session: sessão([vínculo(BRF.id, ['LEAD_ENGINEER'])], true) }));
    await login;

    fixture = TestBed.createComponent(AdminsComponent);
    fixture.detectChanges();
    http.expectOne(`${API}/platform/admins`).flush(admins);
    fixture.detectChanges();
  }

  const el = (seletor: string) => elemento(fixture, seletor);
  const todos = (seletor: string) => elementos(fixture, seletor);
  const texto = () => (fixture.nativeElement as HTMLElement).textContent ?? '';
  const linhaDe = (userId: string) => el(`[data-testid="linha"][data-user="${userId}"]`);

  describe('a lista', () => {
    it('deve mostrar quem administra a plataforma', async () => {
      await abrir();

      expect(todos('[data-testid="linha"]').length).toBe(2);
      expect(linhaDe(outro.userId)!.textContent).toContain('Beatriz');
      expect(linhaDe(outro.userId)!.textContent).toContain('beatriz@normatiza.com');
    });

    it('deve dizer desde quando cada um administra', async () => {
      // Um booleano responderia "é admin?". A pergunta de uma auditoria de
      // verdade é "desde quando, e por obra de quem" — e ninguém reconstrói
      // isso depois.
      await abrir();

      expect(linhaDe(outro.userId)!.querySelector('[data-testid="concedido-em"]')).not.toBeNull();
    });

    it('não deve mostrar quem já teve o acesso revogado como se ainda tivesse', async () => {
      await abrir([euMesmo, { ...outro, revokedAt: '2026-06-01T12:00:00.000Z' }]);

      expect(linhaDe(outro.userId)!.textContent).toContain('Revogado');
      expect(linhaDe(outro.userId)!.querySelector('[data-testid="acao-revogar"]')).toBeNull();
    });
  });

  describe('a concessão', () => {
    function abrirFormulario() {
      clicar(fixture, '[data-testid="conceder"] button');
    }

    it('deve conceder pelo e-mail exato', async () => {
      await abrir();
      abrirFormulario();
      digitar(fixture, '[data-testid="email-do-admin"]', 'beatriz@normatiza.com');
      clicar(fixture, '[data-testid="confirmar-concessao"] button');

      const req = http.expectOne(`${API}/platform/admins`);
      expect(req.request.method).toBe('POST');
      expect(req.request.body).toEqual({ email: 'beatriz@normatiza.com' });

      req.flush(null);
      fixture.detectChanges();

      http.expectOne(`${API}/platform/admins`).flush([euMesmo, outro]);
    });

    it('não deve procurar por trecho — o campo é o endereço inteiro', async () => {
      // Uma busca parcial seria uma varredura do cadastro de todas as
      // consultorias. Quem promove alguém já sabe o e-mail dessa pessoa.
      await abrir();
      abrirFormulario();
      digitar(fixture, '[data-testid="email-do-admin"]', 'bea');
      clicar(fixture, '[data-testid="confirmar-concessao"] button');

      const req = http.expectOne(`${API}/platform/admins`);
      expect(req.request.body).toEqual({ email: 'bea' });
      req.flush(null, { status: 404, statusText: 'Not Found' });
      fixture.detectChanges();

      // E o 404 aparece como a notícia que é, não como falha genérica.
      expect(el('[data-testid="erro-da-concessao"]')).not.toBeNull();
    });

    it('deve dizer quando não há ninguém com aquele e-mail', async () => {
      await abrir();
      abrirFormulario();
      digitar(fixture, '[data-testid="email-do-admin"]', 'ninguem@lugar.com');
      clicar(fixture, '[data-testid="confirmar-concessao"] button');

      http
        .expectOne(`${API}/platform/admins`)
        .flush({ message: 'Nenhum usuário com esse e-mail.' }, { status: 404, statusText: 'NF' });
      fixture.detectChanges();

      expect(texto()).toContain('Nenhum usuário com esse e-mail.');
    });

    it('deve perguntar qual pessoa quando o e-mail alcança mais de uma', async () => {
      // `User.email` é único por conta, não globalmente: o mesmo endereço pode
      // ser duas pessoas em duas consultorias. Escolher sozinho daria acesso
      // total à pessoa errada, em silêncio.
      await abrir();
      abrirFormulario();
      digitar(fixture, '[data-testid="email-do-admin"]', 'beatriz@normatiza.com');
      clicar(fixture, '[data-testid="confirmar-concessao"] button');

      http.expectOne(`${API}/platform/admins`).flush(
        {
          reason: 'USER_SELECTION_REQUIRED',
          candidates: [
            { userId: 'u-a', name: 'Beatriz', accountName: 'Normatiza' },
            { userId: 'u-b', name: 'Beatriz', accountName: 'Outra Consultoria' },
          ],
        },
        { status: 409, statusText: 'Conflict' },
      );
      fixture.detectChanges();

      expect(todos('[data-testid="candidato"]').length).toBe(2);
      // O nome não distingue as duas — a conta é a única coisa que distingue.
      expect(texto()).toContain('Outra Consultoria');
      // E 409 não é falha: não pode aparecer como erro.
      expect(el('[data-testid="erro-da-concessao"]')).toBeNull();
    });

    it('deve conceder à pessoa escolhida no desempate', async () => {
      await abrir();
      abrirFormulario();
      digitar(fixture, '[data-testid="email-do-admin"]', 'beatriz@normatiza.com');
      clicar(fixture, '[data-testid="confirmar-concessao"] button');

      http.expectOne(`${API}/platform/admins`).flush(
        {
          reason: 'USER_SELECTION_REQUIRED',
          candidates: [
            { userId: 'u-a', name: 'Beatriz', accountName: 'Normatiza' },
            { userId: 'u-b', name: 'Beatriz', accountName: 'Outra Consultoria' },
          ],
        },
        { status: 409, statusText: 'Conflict' },
      );
      fixture.detectChanges();

      clicar(fixture, '[data-testid="candidato"][data-user="u-b"]');

      const req = http.expectOne(`${API}/platform/admins`);
      expect(req.request.body).toEqual({ email: 'beatriz@normatiza.com', userId: 'u-b' });
      req.flush(null);
      fixture.detectChanges();

      http.expectOne(`${API}/platform/admins`).flush([euMesmo, outro]);
    });
  });

  describe('a revogação', () => {
    it('deve revogar pelo usuário, não pela concessão', async () => {
      await abrir();

      (linhaDe(outro.userId)!.querySelector('[data-testid="acao-revogar"] button') as HTMLElement).click();
      fixture.detectChanges();

      const req = http.expectOne(`${API}/platform/admins/${outro.userId}`);
      expect(req.request.method).toBe('DELETE');
      req.flush(null);
      fixture.detectChanges();

      http.expectOne(`${API}/platform/admins`).flush([euMesmo]);
    });

    it('não deve oferecer a revogação de si mesmo', async () => {
      // O servidor já recusa — ficar sem nenhum admin é como se perde o
      // Contexto 0. Oferecer o que será recusado é ruído.
      await abrir();

      expect(linhaDe(euMesmo.userId)!.querySelector('[data-testid="acao-revogar"]')).toBeNull();
    });
  });
});
