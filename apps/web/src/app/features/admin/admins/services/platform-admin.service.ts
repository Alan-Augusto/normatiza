import { HttpClient } from '@angular/common/http';
import { Injectable, inject } from '@angular/core';
import { Observable } from 'rxjs';

import type { PlatformAdmin } from '@normatiza/shared';

import { API_BASE_URL } from '../../../../core/auth/api.config';

/**
 * As concessões de acesso ao Contexto 0.
 *
 * Esqueleto: a Fase 5 do plano de gestão de equipe preenche.
 */
@Injectable({ providedIn: 'root' })
export class PlatformAdminService {
  private readonly http = inject(HttpClient);
  private readonly api = inject(API_BASE_URL);

  list(): Observable<PlatformAdmin[]> {
    throw new Error('não implementado');
  }

  grant(userId: string): Observable<void> {
    throw new Error('não implementado');
  }

  revoke(userId: string): Observable<void> {
    throw new Error('não implementado');
  }
}
