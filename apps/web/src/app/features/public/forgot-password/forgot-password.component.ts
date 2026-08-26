import { Component, inject, signal } from '@angular/core';
import { NonNullableFormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { RouterLink } from '@angular/router';

import { AccountRecoveryService } from '../../../core/auth/account-recovery.service';

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

  submit(): void {
    if (this.form.invalid) {
      this.form.markAllAsTouched();
      return;
    }

    this.enviando.set(true);

    // O desfecho é o mesmo para e-mail existente e inexistente — inclusive
    // quando a API falha. Uma tela que se comportasse diferente nos dois casos
    // seria o oráculo que a resposta da API foi desenhada para não ser.
    this.recovery.forgotPassword(this.form.getRawValue().email).subscribe({
      next: () => this.concluir(),
      error: () => this.concluir(),
    });
  }

  private concluir(): void {
    this.enviando.set(false);
    this.enviado.set(true);
  }
}
