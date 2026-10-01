import { ChangeDetectionStrategy, Component, DestroyRef, Directive, OnInit, ViewContainerRef, inject, input, inputBinding, isSignal, outputBinding } from '@angular/core';
import { NavigationStart, Router } from '@angular/router';
import { Dialog } from 'primeng/dialog';
import { filter } from 'rxjs';

import { ModalAberto, ModalService } from './modal.service';

/** Monta o componente do modal com as entradas e saídas pedidas. */
@Directive({ selector: '[appConteudoDoModal]', standalone: true })
export class ConteudoDoModal implements OnInit {
  readonly modal = input.required<ModalAberto>({ alias: 'appConteudoDoModal' });
  private readonly vcr = inject(ViewContainerRef);

  ngOnInit(): void {
    const { componente, opcoes, injector } = this.modal();
    this.vcr.createComponent(componente, {
      injector,
      bindings: [
        // Um signal entra ao vivo: o catálogo que chega depois de aberto o modal aparece nele.
        ...Object.entries(opcoes.entradas ?? {}).map(([nome, valor]) => inputBinding(nome, isSignal(valor) ? valor : () => valor)),
        ...Object.entries(opcoes.saidas ?? {}).map(([nome, fn]) => outputBinding(nome, fn)),
      ],
    });
  }
}

/**
 * O único lugar do app que desenha `p-dialog` (docs/web/design_system.md §10).
 * Fica no `app.html`; as telas abrem modais pelo `ModalService`.
 */
@Component({
  selector: 'app-modal-host',
  standalone: true,
  imports: [Dialog, ConteudoDoModal],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    @for (m of service.abertos(); track m.id) {
      <p-dialog
        [header]="m.opcoes.titulo"
        [visible]="true"
        (visibleChange)="$event || m.ref.fechar()"
        [modal]="true"
        [draggable]="false"
        [resizable]="false"
        [dismissableMask]="!!m.opcoes.fecharClicandoFora"
        [style]="{ width: m.opcoes.largura ?? '32rem' }"
        [breakpoints]="{ '640px': '95vw' }"
        [attr.data-testid]="m.opcoes.testid"
      >
        <ng-container [appConteudoDoModal]="m" />
      </p-dialog>
    }
  `,
})
export class ModalHostComponent {
  protected readonly service = inject(ModalService);

  constructor() {
    // Trocar de página fecha os modais: o que estava aberto era da tela que saiu.
    const inscricao = inject(Router)
      .events.pipe(filter((e) => e instanceof NavigationStart))
      .subscribe(() => this.service.fecharTodos());
    inject(DestroyRef).onDestroy(() => inscricao.unsubscribe());
  }
}
