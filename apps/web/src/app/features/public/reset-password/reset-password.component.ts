import { HttpErrorResponse } from '@angular/common/http';
import { Component, inject, signal } from '@angular/core';
import { toSignal } from '@angular/core/rxjs-interop';
import { NonNullableFormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { ActivatedRoute, Router, RouterLink } from '@angular/router';
import { map } from 'rxjs';

import { AccountRecoveryService } from '../../../core/auth/account-recovery.service';
import { senhasIguais, SENHA_MÍNIMA } from '../nova-senha';

@Component({
  selector: 'app-reset-password',
  standalone: true,
  imports: [ReactiveFormsModule, RouterLink],
  templateUrl: './reset-password.component.html',
})
export class ResetPasswordComponent {
  private readonly recovery = inject(AccountRecoveryService);
  private readonly router = inject(Router);
  private readonly route = inject(ActivatedRoute);
  private readonly fb = inject(NonNullableFormBuilder);

  /** Vem do link do e-mail: `?token=…`. É de uso único e vale por tempo curto. */
  private readonly token = toSignal(
    this.route.queryParams.pipe(map((params) => (params['token'] as string | undefined) ?? '')),
    { initialValue: '' },
  );

  readonly tamanhoMinimo = SENHA_MÍNIMA;

  readonly form = this.fb.group(
    {
      password: ['', [Validators.required, Validators.minLength(SENHA_MÍNIMA)]],
      confirmation: ['', [Validators.required]],
    },
    { validators: senhasIguais },
  );

  readonly enviando = signal(false);
  readonly erro = signal<string | null>(null);

  submit(): void {
    if (this.form.invalid) {
      this.form.markAllAsTouched();
      return;
    }

    this.erro.set(null);
    this.enviando.set(true);

    this.recovery.resetPassword(this.token(), this.form.getRawValue().password).subscribe({
      next: () => {
        // Redefinir a senha encerra todas as sessões ativas, inclusive a de quem
        // roubou o acesso. Por isso o caminho daqui é o login, e não o app.
        void this.router.navigateByUrl('/login');
      },
      error: (erro: unknown) => {
        this.enviando.set(false);
        const expirou = erro instanceof HttpErrorResponse && erro.status < 500;
        this.erro.set(
          expirou
            ? 'Este link não vale mais. Peça a recuperação de novo.'
            : 'Não foi possível concluir agora. Tente de novo em instantes.',
        );
      },
    });
  }
}
