import { Component, computed, effect, inject, input, signal } from '@angular/core';
import { RouterLink } from '@angular/router';
import { ButtonDirective, ButtonLabel } from 'primeng/button';
import { Message } from 'primeng/message';
import { Skeleton } from 'primeng/skeleton';

import {
  COMPANY_STATUS_LABEL,
  formatCep,
  formatCnpj,
  type CompanyDetail,
  type CompanyView,
} from '@normatiza/shared';

import { CompaniesService } from '../../../core/services/companies.service';

/**
 * Os dados da empresa em contexto — aberto pelo nome dela na sidebar
 * (docs/produto/03 §4.0).
 *
 * **Texto, não formulário**: quem abre quer consultar um CNPJ ou um endereço,
 * não editar. A consultoria recebe também o que ela anota sobre o cliente e um
 * atalho para a edição; o cliente recebe a projeção dele, e o recorte é do
 * servidor — aqui só se mostra o que chegou.
 */
@Component({
  selector: 'app-company-info',
  standalone: true,
  imports: [RouterLink, ButtonDirective, ButtonLabel, Message, Skeleton],
  templateUrl: './company-info.component.html',
})
export class CompanyInfoComponent {
  private readonly companies = inject(CompaniesService);

  readonly companyId = input.required<string>();

  readonly empresa = signal<CompanyView | null>(null);
  readonly erro = signal(false);

  readonly daConsultoria = computed<CompanyDetail | null>(() => {
    const e = this.empresa();
    return e?.view === 'CONSULTANCY' ? e : null;
  });

  constructor() {
    effect(() => {
      const id = this.companyId();
      this.empresa.set(null);
      this.erro.set(false);
      this.companies.get(id).subscribe({
        next: (empresa) => this.empresa.set(empresa),
        error: () => this.erro.set(true),
      });
    });
  }

  cnpj(documento: string): string {
    return formatCnpj(documento);
  }

  cep(valor: string): string {
    return formatCep(valor);
  }

  status(empresa: CompanyView): string {
    return COMPANY_STATUS_LABEL[empresa.status];
  }

  /** "Rua X, 86 — Km 12": o complemento só entra quando existe. */
  linhaDoEndereco(empresa: CompanyView): string {
    const { street, number, complement } = empresa.address;
    return complement ? `${street}, ${number} — ${complement}` : `${street}, ${number}`;
  }
}
