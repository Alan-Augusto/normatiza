import { Component, inject } from '@angular/core';
import { Button } from 'primeng/button';
import { InputText } from 'primeng/inputtext';

import { ModalRef } from '../../../core/modal/modal-ref';

/** O exemplo de modal com formulário do design system, aberto pelo `ModalService`. */
@Component({
  selector: 'app-modal-de-exemplo',
  standalone: true,
  imports: [Button, InputText],
  template: `
    <div class="space-y-4 py-3">
      <div class="flex flex-col gap-2">
        <label for="modal-name" class="text-sm font-medium text-surface-900 dark:text-surface-0">Nome do Usuário</label>
        <input pInputText id="modal-name" type="text" placeholder="Digite o nome completo" class="w-full" />
      </div>
      <div class="flex flex-col gap-2">
        <label for="modal-email" class="text-sm font-medium text-surface-900 dark:text-surface-0">E-mail</label>
        <input pInputText id="modal-email" type="email" placeholder="usuario@empresa.com" class="w-full" />
      </div>
      <div class="flex justify-end gap-2">
        <p-button label="Cancelar" [text]="true" severity="secondary" (onClick)="ref.fechar(false)" />
        <p-button label="Salvar Usuário" (onClick)="ref.fechar(true)" />
      </div>
    </div>
  `,
})
export class ModalDeExemploComponent {
  protected readonly ref = inject<ModalRef<boolean>>(ModalRef);
}
