import { Component, DestroyRef, inject, effect } from '@angular/core';
import { RouterOutlet } from '@angular/router';
import { ActiveContextService } from '@core/services/active-context.service';
import { empresaDaRota } from '@core/routing/empresa-da-rota';

/**
 * Contexto 2 — Empresa.
 *
 * Resolve a empresa em contexto a partir do slug da rota e a publica no
 * `ActiveContextService`, que o layout exibe permanentemente acima do título da
 * tela (docs/web/arquitetura.md §5.3). As telas filhas não repetem esse cabeçalho.
 */
@Component({
  selector: 'app-company-layout',
  standalone: true,
  imports: [RouterOutlet],
  templateUrl: './company.layout.html',
  styleUrl: './company.layout.css',
})
export class CompanyLayoutComponent {
  private readonly activeContext = inject(ActiveContextService);

  /**
   * O nome vem da sessão: quem abre esta rota tem vínculo com a empresa — a
   * guarda já trocou o slug pela empresa e conferiu o papel —, e o vínculo
   * carrega o nome fantasia.
   */
  private readonly empresa = empresaDaRota();

  constructor() {
    effect(() => {
      const empresa = this.empresa();
      this.activeContext.setCompany(empresa ? { id: empresa.id, name: empresa.tradeName } : null);
    });

    // Sair da empresa tem de apagar a empresa. Sem isto, o contexto publicado
    // aqui sobrevive à saída: quem voltasse para a carteira continuaria lendo
    // "BRF" na sidebar, dentro de uma tela que não é de empresa nenhuma.
    //
    // `setCompany(null)` derruba o equipamento junto — não existe máquina sem a
    // planta dela.
    inject(DestroyRef).onDestroy(() => this.activeContext.setCompany(null));
  }
}
