import { Component, inject, effect } from '@angular/core';
import { RouterOutlet, ActivatedRoute } from '@angular/router';
import { toSignal } from '@angular/core/rxjs-interop';
import { map } from 'rxjs/operators';
import { ActiveContextService } from '@core/services/active-context.service';

/**
 * Contexto 2 — Empresa.
 *
 * Resolve a empresa em contexto a partir dos parâmetros da rota e a publica no
 * `ActiveContextService`, que o layout exibe permanentemente acima do título da
 * tela (docs/web/arquitetura.md §5.3). As telas filhas não repetem esse cabeçalho.
 */
@Component({
  selector: 'app-company-layout',
  standalone: true,
  imports: [RouterOutlet],
  templateUrl: './company.layout.html',
  styleUrl: './company.layout.css'
})
export class CompanyLayoutComponent {
  private readonly route = inject(ActivatedRoute);
  private readonly activeContext = inject(ActiveContextService);

  private readonly companyId = toSignal(
    this.route.paramMap.pipe(map(params => params.get('companyId'))),
    { initialValue: null }
  );

  constructor() {
    effect(() => {
      const id = this.companyId();
      // TODO: substituir pelo nome real quando a API de empresas existir.
      this.activeContext.setCompany(id ? { id, name: `Empresa ${id}` } : null);
    });
  }
}
