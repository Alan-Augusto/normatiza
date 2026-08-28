import { HttpClient } from '@angular/common/http';
import { Injectable, inject } from '@angular/core';
import { Observable } from 'rxjs';

import type {
  CompanyMember,
  CreateInvitationRequest,
  DisableUserPreview,
  DisableUserRequest,
  InvitationSummary,
  TeamListQuery,
  TeamMember,
  UpdateMembershipRequest,
} from '@normatiza/shared';

import { API_BASE_URL } from '../auth/api.config';

/**
 * O ciclo de vida da pessoa dentro da conta: ver, convidar, mudar de papel,
 * remover da empresa e desligar.
 *
 * Vive em `core/` e não dentro de uma feature porque **duas** telas praticam os
 * mesmos atos sobre o vínculo: a Equipe do Contexto 1 e a Equipe da Empresa do
 * Contexto 2. Duas cópias divergiriam no dia em que uma rota mudasse.
 *
 * Nada aqui decide alçada. Quem pode o quê vem do servidor, dentro de
 * `MemberActions` de cada linha — reimplementar a regra aqui criaria uma
 * segunda resposta para a mesma pergunta.
 */
@Injectable({ providedIn: 'root' })
export class TeamService {
  private readonly http = inject(HttpClient);
  private readonly api = inject(API_BASE_URL);

  /** A equipe **da conta** — Contexto 1. */
  listTeam(filtros: TeamListQuery = {}): Observable<TeamMember[]> {
    throw new Error('não implementado');
  }

  /**
   * Quem tem acesso a **esta** empresa — Contexto 2.
   *
   * Rota própria, e não `listTeam({ companyId })`: a projeção é outra. Esta
   * não nomeia nenhuma outra empresa, nem a conta.
   */
  listCompanyMembers(companyId: string): Observable<CompanyMember[]> {
    throw new Error('não implementado');
  }

  updateMembership(membershipId: string, dados: UpdateMembershipRequest): Observable<void> {
    throw new Error('não implementado');
  }

  /** Remove da **empresa**, não da conta (D8). O vínculo é desativado, não apagado. */
  removeFromCompany(membershipId: string): Observable<void> {
    throw new Error('não implementado');
  }

  /** O que a tela precisa saber antes de oferecer o desligamento (D14). */
  disablePreview(userId: string): Observable<DisableUserPreview> {
    throw new Error('não implementado');
  }

  disable(userId: string, dados: DisableUserRequest = {}): Observable<void> {
    throw new Error('não implementado');
  }

  invite(dados: CreateInvitationRequest): Observable<InvitationSummary> {
    throw new Error('não implementado');
  }

  resendInvitation(invitationId: string): Observable<void> {
    throw new Error('não implementado');
  }

  revokeInvitation(invitationId: string): Observable<void> {
    throw new Error('não implementado');
  }
}
