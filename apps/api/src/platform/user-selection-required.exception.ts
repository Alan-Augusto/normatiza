import { ConflictException } from '@nestjs/common';
import type { AmbiguousGrantResponse, PlatformAdminCandidate } from '@normatiza/shared';

/**
 * O e-mail informado alcança mais de uma pessoa.
 *
 * `User.email` é único **por conta**, não globalmente: o mesmo endereço pode
 * ser o Josué da consultoria A e o Josué da consultoria B. É a mesma ambiguidade
 * que o login resolve pedindo a conta (D16) — aqui ela reaparece porque a
 * concessão também parte de um e-mail.
 *
 * Diferente do login, esta lista pode nomear as contas sem ressalva: quem
 * pergunta é o Contexto 0, a única camada que enxerga todas por definição.
 */
export class UserSelectionRequiredException extends ConflictException {
  constructor(candidates: PlatformAdminCandidate[]) {
    const body: AmbiguousGrantResponse = {
      reason: 'USER_SELECTION_REQUIRED',
      candidates,
    };
    super(body);
  }
}
