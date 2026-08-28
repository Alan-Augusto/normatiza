import { HttpClient } from '@angular/common/http';
import { Injectable, inject } from '@angular/core';
import { Observable } from 'rxjs';

import type { GrantPlatformAdminRequest, PlatformAdmin } from '@normatiza/shared';

import { API_BASE_URL } from '../../../../core/auth/api.config';

/**
 * As concessões de acesso ao Contexto 0.
 *
 * A revogação é **pelo usuário**, não pela concessão: o que se tira é o acesso
 * da pessoa, e a linha de `PlatformAdmin` continua existindo com `revokedAt`
 * preenchido — quem auditar precisa achar que houve, não que nunca houve.
 */
@Injectable({ providedIn: 'root' })
export class PlatformAdminService {
  private readonly http = inject(HttpClient);
  private readonly api = inject(API_BASE_URL);

  list(): Observable<PlatformAdmin[]> {
    return this.http.get<PlatformAdmin[]>(`${this.api}/platform/admins`);
  }

  /**
   * Concede pelo **e-mail exato**. O `userId` só aparece na segunda tentativa,
   * quando o servidor respondeu 409 dizendo que aquele endereço alcança mais de
   * uma pessoa — `User.email` é único por conta, não globalmente.
   */
  grant(pedido: GrantPlatformAdminRequest): Observable<void> {
    return this.http.post<void>(`${this.api}/platform/admins`, pedido);
  }

  revoke(userId: string): Observable<void> {
    return this.http.delete<void>(`${this.api}/platform/admins/${userId}`);
  }
}
