import { HttpClient } from '@angular/common/http';
import { Injectable, inject } from '@angular/core';
import { Observable } from 'rxjs';

import type { ChangePasswordRequest, UpdateProfileRequest } from '@normatiza/shared';

import { API_BASE_URL } from '../../../../core/auth/api.config';

/**
 * O próprio cadastro.
 *
 * Não recebe id de usuário: "editar o perfil de outro" não existe. Quem é o
 * dono destes dados vem do token, no servidor — um id na rota criaria um
 * caminho que a regra de negócio não tem.
 */
@Injectable({ providedIn: 'root' })
export class ProfileService {
  private readonly http = inject(HttpClient);
  private readonly api = inject(API_BASE_URL);

  /** Sem `email` (D7): trocar o e-mail de um login é passar a receber os links dele. */
  updateProfile(dados: UpdateProfileRequest): Observable<void> {
    return this.http.patch<void>(`${this.api}/users/me`, dados);
  }

  changePassword(dados: ChangePasswordRequest): Observable<void> {
    return this.http.post<void>(`${this.api}/users/me/password`, dados);
  }
}
