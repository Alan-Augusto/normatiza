import { Component } from '@angular/core';

import { ROLE_LABEL, ROLE_LIMIT, ROLE_ORDER, ROLE_SIDE_LABEL, ROLE_SUMMARY, rolesBySide, type Role } from '@normatiza/shared';

/** O corpo do guia "O que cada papel faz", aberto pelo `ModalService` (ver `RoleGuideComponent`). */
@Component({
  selector: 'app-role-guide-content',
  standalone: true,
  templateUrl: './role-guide-content.component.html',
})
export class RoleGuideContentComponent {
  /** Todos os papéis, por lado, na ordem de alçada — nunca alfabética. */
  protected readonly grupos = rolesBySide(ROLE_ORDER).map((grupo) => ({
    ...grupo,
    titulo: ROLE_SIDE_LABEL[grupo.side],
  }));

  protected rotulo(papel: Role): string {
    return ROLE_LABEL[papel];
  }

  protected resumo(papel: Role): string {
    return ROLE_SUMMARY[papel];
  }

  protected limite(papel: Role): string {
    return ROLE_LIMIT[papel];
  }
}
