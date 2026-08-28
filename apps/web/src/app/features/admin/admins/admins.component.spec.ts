import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { ComponentFixture, TestBed } from '@angular/core/testing';
import { provideRouter } from '@angular/router';
import { firstValueFrom } from 'rxjs';

import type { PlatformAdmin } from '@normatiza/shared';

import { API_BASE_URL } from '../../../core/auth/api.config';
import { AuthService } from '../../../core/auth/auth.service';
import { BRF, respostaDeLogin, sessão, vínculo } from '../../../core/auth/testing/sessao';
import { elemento, elementos } from '../../../core/testing/prime';
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
