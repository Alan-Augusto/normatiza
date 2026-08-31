import { Component, DestroyRef, inject, effect } from '@angular/core';
import { RouterOutlet, ActivatedRoute } from '@angular/router';
import { toSignal } from '@angular/core/rxjs-interop';
import { map } from 'rxjs/operators';
import { ActiveContextService } from '@core/services/active-context.service';
import { AuthService } from '@core/auth/auth.service';

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
  styleUrl: './company.layout.css',
})
export class CompanyLayoutComponent {
  private readonly route = inject(ActivatedRoute);
  private readonly activeContext = inject(ActiveContextService);
  private readonly auth = inject(AuthService);

  private readonly companyId = toSignal(
    this.route.paramMap.pipe(map((params) => params.get('companyId'))),
    { initialValue: null },
  );

  constructor() {
    effect(() => {
      const id = this.companyId();
      if (!id) {
        this.activeContext.setCompany(null);
        return;
      }

      // O nome vem da sessão: quem abre esta rota tem vínculo com a empresa, e
      // o vínculo já carrega o nome fantasia. Sem ele, o cabeçalho de contexto
      // e a migalha mostrariam o `cuid` da empresa — que não diz nada a
      // ninguém. O `id` como último recurso é para o caso que a guarda já
      // impede: sem vínculo, não se chega aqui.
      const empresa = this.auth.companyInScope(id);
      this.activeContext.setCompany({ id, name: empresa?.tradeName ?? id });
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
