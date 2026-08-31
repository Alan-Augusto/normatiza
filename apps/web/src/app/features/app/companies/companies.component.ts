import { Component, computed, inject } from '@angular/core';
import { RouterLink } from '@angular/router';

import type { CompanySummary } from '@normatiza/shared';

import { AuthService } from '../../../core/auth/auth.service';

/**
 * Carteira de empresas atendidas — Contexto 1.
 *
 * **Provisória.** Existe para que a travessia entre contextos possa ser
 * exercida antes de o cadastro de empresa existir; o desenho vem com a feature
 * dela.
 *
 * A lista sai da **sessão**, e não de um `GET /companies` — que não existe.
 * Não é atalho: `memberships[].company` já é a carteira de quem está olhando,
 * recortada pelo escopo no servidor. É a mesma fonte que `rotaDaConsultoria()`
 * usa para decidir a porta de entrada. Quando a feature de empresas chegar com
 * o endpoint próprio (contagem de equipamentos, grau de adequação), só a fonte
 * muda.
 */
@Component({
  selector: 'app-companies',
  standalone: true,
  imports: [RouterLink],
  templateUrl: './companies.component.html',
  styleUrl: './companies.component.css',
})
export class CompaniesComponent {
  private readonly auth = inject(AuthService);

  /**
   * Uma linha por empresa, não por vínculo: quem acumula dois papéis na mesma
   * planta tem dois vínculos e uma empresa só.
   */
  readonly empresas = computed<CompanySummary[]>(() => {
    const porId = new Map<string, CompanySummary>();

    for (const vínculo of this.auth.session()?.memberships ?? []) {
      if (vínculo.isActive) porId.set(vínculo.companyId, vínculo.company);
    }

    return [...porId.values()].sort((a, b) => a.tradeName.localeCompare(b.tradeName));
  });
}
