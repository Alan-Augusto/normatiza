import { HttpClient } from '@angular/common/http';
import { Injectable, computed, inject, signal } from '@angular/core';
import { Observable, catchError, finalize, of, shareReplay, tap } from 'rxjs';

import type { LoginRequest, LoginResponse, Role, SessionUser, User } from '@normatiza/shared';

import { API_BASE_URL } from './api.config';

/**
 * A sessão do painel web.
 *
 * O access token vive **em memória** e só aqui. Não vai para `localStorage` nem
 * para `sessionStorage`: o que está em storage é legível por qualquer script que
 * consiga entrar na página, e um token de 15 minutos roubado é uma sessão
 * roubada. O que sobrevive ao recarregamento é o refresh token, que está em
 * cookie `httpOnly` — fora do alcance do JavaScript, inclusive do nosso.
 *
 * É por isso que `restoreSession()` existe: recarregar a página zera a memória,
 * e a sessão precisa voltar do cookie.
 */
@Injectable({ providedIn: 'root' })
export class AuthService {
  private readonly http = inject(HttpClient);
  private readonly api = inject(API_BASE_URL);

  private accessToken: string | null = null;
  private readonly _session = signal<SessionUser | null>(null);

  /**
   * O refresh em andamento, compartilhado.
   *
   * Sem isto, seis requisições que expiram juntas disparariam seis refreshes —
   * e como o servidor rotaciona o refresh token a cada uso, cinco deles
   * chegariam com um token já consumido. A detecção de reúso derrubaria a
   * família inteira, e o usuário seria deslogado justamente por ter tentado
   * renovar a sessão do jeito certo.
   */
  private refreshEmVoo: Observable<LoginResponse> | null = null;

  readonly session = this._session.asReadonly();
  readonly isAuthenticated = computed(() => this._session() !== null);

  /**
   * Acesso ao Contexto 0 — dimensão de plataforma, não papel de vínculo. É o que
   * permite ao dono do produto ser Engenheiro Responsável da consultoria dele e
   * admin da plataforma com um login só.
   */
  readonly isPlatformAdmin = computed(() => this._session()?.isPlatformAdmin === true);

  /**
   * Titular da conta — quem responde por ela, e por isso quem cuida de plano e
   * faturamento. Não é o mesmo que "tem o papel mais graúdo": hoje o titular é
   * sempre o Engenheiro Responsável, mas perguntar pelo papel amarraria a regra
   * a essa coincidência.
   */
  readonly isAccountOwner = computed(() => {
    const sessão = this._session();
    return !!sessão && sessão.account.ownerUserId === sessão.user.id;
  });

  token(): string | null {
    return this.accessToken;
  }

  login(credenciais: LoginRequest): Observable<LoginResponse> {
    return this.http
      .post<LoginResponse>(`${this.api}/auth/login`, credenciais, { withCredentials: true })
      .pipe(tap((resposta) => this.aplicar(resposta)));
  }

  refresh(): Observable<LoginResponse> {
    return this.http
      .post<LoginResponse>(`${this.api}/auth/refresh`, {}, { withCredentials: true })
      .pipe(tap((resposta) => this.aplicar(resposta)));
  }

  /** O refresh que o interceptor usa: um só, por mais chamadas que o peçam. */
  refreshCompartilhado(): Observable<LoginResponse> {
    this.refreshEmVoo ??= this.refresh().pipe(
      finalize(() => (this.refreshEmVoo = null)),
      shareReplay({ bufferSize: 1, refCount: false }),
    );
    return this.refreshEmVoo;
  }

  logout(): Observable<void> {
    // A limpeza vai no `finalize` porque ela precisa acontecer mesmo se a API
    // estiver fora do ar: manter a tela "logada" porque o servidor não respondeu
    // é o pior dos dois mundos.
    return this.http
      .post<void>(`${this.api}/auth/logout`, {}, { withCredentials: true })
      .pipe(finalize(() => this.encerrarLocalmente()));
  }

  /** Descarta a sessão sem falar com a API — para quando ela já foi recusada. */
  encerrarLocalmente(): void {
    this.accessToken = null;
    this._session.set(null);
  }

  /**
   * Chamado no boot. Falhar aqui é o caminho normal de quem ainda não entrou,
   * então o erro é engolido de propósito: primeiro acesso não é tela de erro.
   */
  restoreSession(): Observable<unknown> {
    return this.refresh().pipe(catchError(() => of(null)));
  }

  /**
   * Reflete na sessão o que a própria pessoa acabou de mudar no cadastro dela.
   *
   * O nome aparece no menu e na saudação. Sem isto, quem salvasse "Marcos
   * Silva" continuaria vendo "Marcos" até o próximo refresh — e a tela pareceria
   * não ter salvado. Não é fonte da verdade: é a mesma verdade que o servidor
   * acabou de aceitar, sem uma segunda ida à rede para buscá-la de volta.
   */
  atualizarPerfil(dados: Partial<User>): void {
    this._session.update((sessão) =>
      sessão ? { ...sessão, user: { ...sessão.user, ...dados } } : sessão,
    );
  }

  rolesInCompany(companyId: string): Role[] {
    return this.vínculosAtivos()
      .filter((vínculo) => vínculo.companyId === companyId)
      .flatMap((vínculo) => vínculo.roles);
  }

  /**
   * Sem `companyId`, pergunta "tem esse papel em algum lugar?" — é o que
   * decide menu e porta de entrada. Com `companyId`, pergunta "tem esse papel
   * **aqui**?", que é o que decide acesso a uma tela de empresa.
   */
  hasRole(roles: readonly Role[], companyId?: string): boolean {
    const escopo = companyId
      ? this.vínculosAtivos().filter((vínculo) => vínculo.companyId === companyId)
      : this.vínculosAtivos();

    return escopo.some((vínculo) => vínculo.roles.some((papel) => roles.includes(papel)));
  }

  private vínculosAtivos() {
    return (this._session()?.memberships ?? []).filter((vínculo) => vínculo.isActive);
  }

  private aplicar(resposta: LoginResponse): void {
    this.accessToken = resposta.accessToken;
    this._session.set(resposta.session);
  }
}
