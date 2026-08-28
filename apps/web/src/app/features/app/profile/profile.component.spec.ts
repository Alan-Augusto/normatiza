import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { ComponentFixture, TestBed } from '@angular/core/testing';
import { provideRouter } from '@angular/router';
import { firstValueFrom } from 'rxjs';

import type { MembershipWithCompany } from '@normatiza/shared';

import { API_BASE_URL } from '../../../core/auth/api.config';
import { AuthService } from '../../../core/auth/auth.service';
import { BRF, SEARA, respostaDeLogin, sessão, vínculo } from '../../../core/auth/testing/sessao';
import { clicar as clicarNo, digitar as digitarEm, elemento } from '../../../core/testing/prime';
import { ProfileComponent } from './profile.component';

/**
 * Meu Perfil.
 *
 * A única tela que todo mundo tem, de qualquer papel e de qualquer lado. É onde
 * a pessoa entende **o que ela é no sistema** — e é a razão de os vínculos
 * aparecerem aqui, e não só numa tela de administração que ela não abre.
 */
describe('ProfileComponent', () => {
  let fixture: ComponentFixture<ProfileComponent>;
  let http: HttpTestingController;

  const API = 'http://api.teste';

  beforeEach(() => {
    TestBed.configureTestingModule({
      imports: [ProfileComponent],
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

  async function abrirComo(memberships: MembershipWithCompany[]): Promise<void> {
    const auth = TestBed.inject(AuthService);
    const login = firstValueFrom(auth.login({ email: 'marcos@brf.com', password: 'certa' }));
    http.expectOne(`${API}/auth/login`).flush(respostaDeLogin({ session: sessão(memberships) }));
    await login;

    fixture = TestBed.createComponent(ProfileComponent);
    fixture.detectChanges();
  }

  const texto = () => (fixture.nativeElement as HTMLElement).textContent ?? '';
  const el = (seletor: string) => elemento(fixture, seletor);

  const digitar = (seletor: string, valor: string) => digitarEm(fixture, seletor, valor);

  /** O `p-button` envolve o `<button>` de verdade — é nele que o clique vale. */
  const clicar = (seletor: string) => clicarNo(fixture, `${seletor} button`);

  describe('os dados próprios', () => {
    it('deve trazer o cadastro de quem está na sessão, já preenchido', async () => {
      await abrirComo([vínculo(BRF.id, ['MANAGER'])]);

      expect((el('[data-testid="nome"]') as HTMLInputElement).value).toBe('Marcos');
      expect((el('[data-testid="email"]') as HTMLInputElement).value).toBe('marcos@brf.com');
    });

    it('deve deixar o e-mail em leitura, e dizer por quê', async () => {
      // D7: mudar o e-mail de um login é passar a receber os links de
      // redefinição dele. Um campo editável aqui seria uma tomada de conta com
      // dois cliques — se um dia existir troca, é fluxo próprio, com
      // confirmação nos dois endereços.
      await abrirComo([vínculo(BRF.id, ['MANAGER'])]);

      const campo = el('[data-testid="email"]') as HTMLInputElement;
      expect(campo.readOnly || campo.disabled).toBe(true);
      expect(el('[data-testid="email-nota"]')).not.toBeNull();
    });

    it('deve salvar nome e telefone', async () => {
      await abrirComo([vínculo(BRF.id, ['MANAGER'])]);

      digitar('[data-testid="nome"]', 'Marcos Silva');
      digitar('[data-testid="telefone"]', '(47) 99999-0000');
      clicar('[data-testid="salvar-perfil"]');

      const req = http.expectOne(`${API}/users/me`);
      expect(req.request.method).toBe('PATCH');
      expect(req.request.body).toMatchObject({
        name: 'Marcos Silva',
        phone: '(47) 99999-0000',
      });
      req.flush(null);
      fixture.detectChanges();
    });

    it('não deve mandar o e-mail no corpo, nem mesmo inalterado', async () => {
      // O servidor recusa o corpo inteiro se `email` vier junto — e recusa de
      // propósito. Mandar "só para constar" viraria erro 400 numa tela que a
      // pessoa preencheu certo.
      await abrirComo([vínculo(BRF.id, ['MANAGER'])]);

      digitar('[data-testid="nome"]', 'Marcos Silva');
      clicar('[data-testid="salvar-perfil"]');

      const req = http.expectOne(`${API}/users/me`);
      expect(req.request.body.email).toBeUndefined();
      req.flush(null);
      fixture.detectChanges();
    });

    it('deve avisar quando o servidor recusa o que foi enviado', async () => {
      await abrirComo([vínculo(BRF.id, ['MANAGER'])]);

      digitar('[data-testid="nome"]', 'x'.repeat(200));
      clicar('[data-testid="salvar-perfil"]');

      http
        .expectOne(`${API}/users/me`)
        .flush({ message: 'Nome longo demais.' }, { status: 400, statusText: 'Bad Request' });
      fixture.detectChanges();

      expect(texto()).toContain('Nome longo demais.');
    });
  });

  describe('a própria senha', () => {
    it('deve exigir a senha atual junto da nova', async () => {
      // Sessão válida não basta: uma aba esquecida aberta não pode trocar a
      // credencial permanente de alguém.
      await abrirComo([vínculo(BRF.id, ['MANAGER'])]);

      digitar('[data-testid="senha-nova"]', 'senha-nova-123456');
      clicar('[data-testid="salvar-senha"]');

      http.expectNone(`${API}/users/me/password`);
      expect(texto()).toContain('senha atual');
    });

    it('deve trocar a senha quando as duas são informadas', async () => {
      await abrirComo([vínculo(BRF.id, ['MANAGER'])]);

      digitar('[data-testid="senha-atual"]', 'a-de-agora');
      digitar('[data-testid="senha-nova"]', 'senha-nova-123456');
      clicar('[data-testid="salvar-senha"]');

      const req = http.expectOne(`${API}/users/me/password`);
      expect(req.request.method).toBe('POST');
      expect(req.request.body).toEqual({
        currentPassword: 'a-de-agora',
        newPassword: 'senha-nova-123456',
      });
      req.flush(null);
      fixture.detectChanges();
    });

    it('deve dizer que a senha atual não confere, em vez de falhar em silêncio', async () => {
      await abrirComo([vínculo(BRF.id, ['MANAGER'])]);

      digitar('[data-testid="senha-atual"]', 'chute');
      digitar('[data-testid="senha-nova"]', 'senha-nova-123456');
      clicar('[data-testid="salvar-senha"]');

      http
        .expectOne(`${API}/users/me/password`)
        .flush({ message: 'Senha atual incorreta.' }, { status: 401, statusText: 'Unauthorized' });
      fixture.detectChanges();

      expect(texto()).toContain('Senha atual incorreta.');
    });

    it('deve avisar que trocar a senha encerra as outras sessões', async () => {
      // O servidor revoga tudo, inclusive a sessão de quem trocou. Descobrir
      // isso sendo deslogado no meio do trabalho é pior do que ler antes.
      await abrirComo([vínculo(BRF.id, ['MANAGER'])]);

      expect(texto().toLowerCase()).toContain('sessõe');
    });
  });

  describe('o que a pessoa é no sistema', () => {
    it('deve mostrar os próprios vínculos com empresa e papel', async () => {
      await abrirComo([
        vínculo(BRF.id, ['CONSULTANT_ENGINEER']),
        vínculo(SEARA.id, ['TECHNICIAN']),
      ]);

      const vínculos = el('[data-testid="meus-vinculos"]')!;
      expect(vínculos.textContent).toContain('BRF');
      expect(vínculos.textContent).toContain('Engenheiro da Consultoria');
      expect(vínculos.textContent).toContain('Seara');
      expect(vínculos.textContent).toContain('Técnico');
    });

    it('deve pedir registro profissional só de quem o papel comporta', async () => {
      // CREA/CFT é de quem assina responsabilidade técnica. Pedi-lo ao Executor
      // é perguntar por um documento que ele não tem por que ter.
      await abrirComo([vínculo(BRF.id, ['EXECUTOR'])]);

      // A ausência só significa alguma coisa se o resto da tela estiver lá:
      // "não achei o campo" numa tela vazia passaria contra qualquer erro.
      expect(el('[data-testid="salvar-perfil"]')).not.toBeNull();
      expect(el('[data-testid="registro"]')).toBeNull();
    });

    it('deve oferecer registro profissional ao engenheiro', async () => {
      await abrirComo([vínculo(BRF.id, ['CONSULTANT_ENGINEER'])]);

      expect(el('[data-testid="registro"]')).not.toBeNull();
    });
  });
});
