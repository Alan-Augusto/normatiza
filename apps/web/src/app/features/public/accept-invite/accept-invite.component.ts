import { Component, inject, signal } from '@angular/core';
import { toSignal } from '@angular/core/rxjs-interop';
import { NonNullableFormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { ActivatedRoute, Router, RouterLink } from '@angular/router';
import { map } from 'rxjs';

import { AccountRecoveryService } from '../../../core/auth/account-recovery.service';
import { mensagemDoServidor } from '../../../core/http/mensagem-de-erro';
import { SENHA_MÍNIMA, senhasIguais } from '../nova-senha';

/**
 * O convite é a única porta de entrada do sistema, e o convidado **não preenche
 * cadastro**: nome, papéis e empresas já foram decididos por quem convidou. O
 * que falta é só a senha.
 */
@Component({
  selector: 'app-accept-invite',
  standalone: true,
  imports: [ReactiveFormsModule, RouterLink],
  templateUrl: './accept-invite.component.html',
})
export class AcceptInviteComponent {
  private readonly recovery = inject(AccountRecoveryService);
  private readonly router = inject(Router);
  private readonly route = inject(ActivatedRoute);
  private readonly fb = inject(NonNullableFormBuilder);

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

    this.recovery.acceptInvitation(this.token(), this.form.getRawValue().password).subscribe({
      next: () => void this.router.navigateByUrl('/login'),
      error: (erro: unknown) => {
        this.enviando.set(false);
        // O servidor distingue "convite já usado" de "senha curta demais". A
        // tela repete o que ele disse em vez de chamar tudo de convite vencido.
        this.erro.set(
          mensagemDoServidor(erro, 'Não foi possível concluir agora. Tente de novo em instantes.'),
        );
      },
    });
  }
}
