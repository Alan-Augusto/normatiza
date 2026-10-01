import { HttpErrorResponse } from '@angular/common/http';
import { Component, inject, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { Button } from 'primeng/button';
import { InputText } from 'primeng/inputtext';
import { Message } from 'primeng/message';

import type { AmbiguousGrantResponse, PlatformAdminCandidate } from '@normatiza/shared';

import { mensagemDoServidor } from '../../../../core/http/mensagem-de-erro';
import { ModalRef } from '../../../../core/modal/modal-ref';
import { PlatformAdminService } from '../services/platform-admin.service';

/**
 * Conceder acesso de admin, por **e-mail exato** (D19). Quando o mesmo e-mail
 * alcança duas pessoas em consultorias diferentes, o servidor devolve 409 com
 * os candidatos e quem concede escolhe. Aberto pelo `ModalService`; fecha com
 * `true` ao conceder.
 */
@Component({
  selector: 'app-conceder-admin',
  standalone: true,
  imports: [FormsModule, Button, InputText, Message],
  templateUrl: './conceder-admin.component.html',
})
export class ConcederAdminComponent {
  private readonly ref = inject<ModalRef<boolean>>(ModalRef);
  private readonly platformAdmins = inject(PlatformAdminService);

  readonly email = signal('');
  readonly concedendoEmAndamento = signal(false);
  readonly erroDaConcessao = signal<string | null>(null);

  /** Vazio na primeira tentativa; preenchido quando o e-mail alcança mais de uma pessoa. */
  readonly candidatos = signal<PlatformAdminCandidate[]>([]);

  conceder(userId?: string): void {
    const email = this.email().trim();
    if (!email) return;

    this.erroDaConcessao.set(null);
    this.concedendoEmAndamento.set(true);

    this.platformAdmins.grant({ email, ...(userId ? { userId } : {}) }).subscribe({
      next: () => this.ref.fechar(true),
      error: (falha: unknown) => {
        this.concedendoEmAndamento.set(false);

        // 409 não é falha: é o servidor perguntando qual das pessoas é.
        if (falha instanceof HttpErrorResponse && falha.status === 409) {
          const corpo = falha.error as AmbiguousGrantResponse | null;
          this.candidatos.set(corpo?.candidates ?? []);
          return;
        }

        this.erroDaConcessao.set(mensagemDoServidor(falha, 'Não foi possível conceder o acesso agora.'));
      },
    });
  }
}
