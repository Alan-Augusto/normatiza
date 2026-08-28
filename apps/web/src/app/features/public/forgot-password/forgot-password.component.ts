import { Component, inject, signal } from '@angular/core';
import { NonNullableFormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { RouterLink } from '@angular/router';

import { AccountRecoveryService } from '../../../core/auth/account-recovery.service';
import { aparaEmail } from '../../../core/forms/email';
import { mensagemDoServidor } from '../../../core/http/mensagem-de-erro';

@Component({
  selector: 'app-forgot-password',
  standalone: true,
  imports: [ReactiveFormsModule, RouterLink],
  templateUrl: './forgot-password.component.html',
})
export class ForgotPasswordComponent {
  private readonly recovery = inject(AccountRecoveryService);
  private readonly fb = inject(NonNullableFormBuilder);

  readonly form = this.fb.group({
    email: ['', [Validators.required, Validators.email]],
  });

  readonly enviando = signal(false);
  readonly enviado = signal(false);
  readonly erro = signal<string | null>(null);

  submit(): void {
    aparaEmail(this.form.controls.email);

    if (this.form.invalid) {
      this.form.markAllAsTouched();
      return;
    }

    this.enviando.set(true);
    this.erro.set(null);

    /*
     * O sigilo desta tela é sobre **existir ou não a conta** — e disso ela nem
     * fica sabendo: a API responde 202 nos dois casos, com o mesmo corpo.
     *
     * O que ela não pode fazer é estender esse silêncio à falha de transporte.
     * Engolir o erro aqui, como se fazia antes, manda a pessoa esperar um
     * e-mail que ninguém chegou a tentar mandar — e some com o único sinal de
     * que havia algo errado. Foi assim que um pedido que nunca saiu do
     * navegador passou por "enviado".
     */
    this.recovery.forgotPassword(this.form.getRawValue().email).subscribe({
      next: () => {
        this.enviando.set(false);
        this.enviado.set(true);
      },
      error: (falha: unknown) => {
        this.enviando.set(false);
        this.erro.set(
          mensagemDoServidor(
            falha,
            'Não foi possível pedir a redefinição agora. Tente de novo em instantes.',
          ),
        );
      },
    });
  }
}
