import { ChangeDetectionStrategy, Component, computed, input, linkedSignal } from '@angular/core';
import { NgIconComponent, provideIcons } from '@ng-icons/core';
import { lucideBuilding2 } from '@ng-icons/lucide';

/**
 * O logo pequeno ao lado do nome da empresa, e o ícone de empresa no lugar
 * dele quando não há logo — ou quando ele não carrega: a URL é assinada e
 * vence, e uma lista aberta há muito tempo não pode mostrar imagem quebrada.
 *
 * Decorativo (`alt=""`): o nome está sempre ao lado, e o leitor de tela não
 * precisa ouvi-lo duas vezes.
 */
@Component({
  selector: 'app-company-logo',
  standalone: true,
  imports: [NgIconComponent],
  providers: [provideIcons({ lucideBuilding2 })],
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: './company-logo.component.html',
  styleUrl: './company-logo.component.css',
})
export class CompanyLogoComponent {
  readonly url = input<string | undefined>(undefined);

  /** Volta a `false` a cada URL nova: um logo trocado merece nova tentativa. */
  private readonly falhou = linkedSignal({ source: this.url, computation: () => false });

  readonly imagem = computed(() => (this.falhou() ? undefined : this.url()));

  aoFalhar(): void {
    this.falhou.set(true);
  }
}
