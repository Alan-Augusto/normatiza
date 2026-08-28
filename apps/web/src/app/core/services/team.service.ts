import { HttpClient, HttpParams } from '@angular/common/http';
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
    return this.http.get<TeamMember[]>(`${this.api}/users`, { params: paramsDe(filtros) });
  }

  /**
   * Quem tem acesso a **esta** empresa — Contexto 2.
   *
   * Rota própria, e não `listTeam({ companyId })`: a projeção é outra. Esta
   * não nomeia nenhuma outra empresa, nem a conta.
   */
  listCompanyMembers(companyId: string): Observable<CompanyMember[]> {
    return this.http.get<CompanyMember[]>(`${this.api}/companies/${companyId}/members`);
  }

  updateMembership(membershipId: string, dados: UpdateMembershipRequest): Observable<void> {
    return this.http.patch<void>(`${this.api}/memberships/${membershipId}`, dados);
  }

  /** Remove da **empresa**, não da conta (D8). O vínculo é desativado, não apagado. */
  removeFromCompany(membershipId: string): Observable<void> {
    return this.http.delete<void>(`${this.api}/memberships/${membershipId}`);
  }

  /** O que a tela precisa saber antes de oferecer o desligamento (D14). */
  disablePreview(userId: string): Observable<DisableUserPreview> {
    return this.http.get<DisableUserPreview>(`${this.api}/users/${userId}/disable-preview`);
  }

  disable(userId: string, dados: DisableUserRequest = {}): Observable<void> {
    return this.http.post<void>(`${this.api}/users/${userId}/disable`, dados);
  }

  invite(dados: CreateInvitationRequest): Observable<InvitationSummary> {
    return this.http.post<InvitationSummary>(`${this.api}/invitations`, dados);
  }

  resendInvitation(invitationId: string): Observable<void> {
    return this.http.post<void>(`${this.api}/invitations/${invitationId}/resend`, {});
  }

  revokeInvitation(invitationId: string): Observable<void> {
    return this.http.delete<void>(`${this.api}/invitations/${invitationId}`);
  }
}

/**
 * Filtro não escolhido **não vira parâmetro**.
 *
 * `?role=` vazio não é "todos os papéis" para o servidor: é um valor fora do
 * enum, e a resposta seria 400 numa listagem que a pessoa nem filtrou.
 */
function paramsDe(filtros: TeamListQuery): HttpParams {
  let params = new HttpParams();
  for (const [chave, valor] of Object.entries(filtros)) {
    if (valor) params = params.set(chave, valor);
  }
  return params;
}
