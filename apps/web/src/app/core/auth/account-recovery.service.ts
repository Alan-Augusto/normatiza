import { HttpClient } from '@angular/common/http';
import { Injectable, inject } from '@angular/core';
import { Observable } from 'rxjs';

import type { ForgotPasswordResponse } from '@normatiza/shared';

import { API_BASE_URL } from './api.config';

/**
 * As portas que não passam por senha conhecida: aceitar convite, pedir
 * recuperação e redefinir.
 *
 * Em todas, o token de uso único viaja **no corpo**. Caminho de URL acaba em
 * log de servidor, histórico de navegador e cabeçalho `Referer` — e um token
 * que define a senha de alguém não tem por que passar por lá.
 */
@Injectable({ providedIn: 'root' })
export class AccountRecoveryService {
  private readonly http = inject(HttpClient);
  private readonly api = inject(API_BASE_URL);

  forgotPassword(email: string): Observable<ForgotPasswordResponse> {
    return this.http.post<ForgotPasswordResponse>(`${this.api}/auth/forgot-password`, { email });
  }

  resetPassword(token: string, password: string): Observable<void> {
    return this.http.post<void>(`${this.api}/auth/reset-password`, { token, password });
  }

  acceptInvitation(token: string, password: string): Observable<void> {
    return this.http.post<void>(`${this.api}/invitations/accept`, { token, password });
  }
}
