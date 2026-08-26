import { ConflictException } from '@nestjs/common';
import type { AccountChoice, AmbiguousLoginResponse } from '@normatiza/shared';

/**
 * O e-mail e a senha informados valem em mais de uma consultoria — possível
 * porque `User.email` é único por conta, não globalmente.
 *
 * Só é lançada **depois** de a senha ser verificada e bater. Lançá-la antes
 * transformaria o login num oráculo: bastaria digitar um e-mail para descobrir
 * de quais consultorias aquela pessoa é cliente.
 */
export class AccountSelectionRequiredException extends ConflictException {
  constructor(accounts: AccountChoice[]) {
    const body: AmbiguousLoginResponse = {
      reason: 'ACCOUNT_SELECTION_REQUIRED',
      accounts,
    };
    super(body);
  }
}
