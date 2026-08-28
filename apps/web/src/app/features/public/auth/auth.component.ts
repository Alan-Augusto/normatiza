import { HttpErrorResponse } from '@angular/common/http';
import { Component, inject, signal } from '@angular/core';
import { toSignal } from '@angular/core/rxjs-interop';
import { NonNullableFormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { ActivatedRoute, Router, RouterLink } from '@angular/router';
import { map } from 'rxjs';

import type { AccountChoice, AmbiguousLoginResponse, SessionUser } from '@normatiza/shared';

import { AuthService } from '../../../core/auth/auth.service';
import { aparaEmail } from '../../../core/forms/email';
import { mensagemDoServidor } from '../../../core/http/mensagem-de-erro';
import { rotaDeEntrada } from '../../../core/auth/entry-route';

const FALHA_GENÉRICA = 'Não foi possível entrar agora. Tente de novo em instantes.';

@Component({
  selector: 'app-auth',
  standalone: true,
  imports: [ReactiveFormsModule, RouterLink],
  templateUrl: './auth.component.html',
  styleUrl: './auth.component.css',
})
export class AuthComponent {
  private readonly auth = inject(AuthService);
  private readonly router = inject(Router);
  private readonly route = inject(ActivatedRoute);
  private readonly fb = inject(NonNullableFormBuilder);

  /** Posto pelo `authGuard` quando ele barrou a navegação de alguém sem sessão. */
  private readonly returnUrl = toSignal(
    this.route.queryParams.pipe(map((params) => params['returnUrl'] as string | undefined)),
  );

  readonly form = this.fb.group({
    email: ['', [Validators.required, Validators.email]],
    password: ['', [Validators.required]],
  });

  readonly enviando = signal(false);
  readonly erro = signal<string | null>(null);

  /**
   * As consultorias em que o e-mail e a senha informados valem (D16). Só chega
   * aqui **depois** de a senha ter batido — a API não devolve esta lista antes,
   * ou o login viraria um jeito de descobrir quem é cliente de quem.
   */
  readonly contas = signal<AccountChoice[]>([]);

  submit(accountId?: string): void {
    // O e-mail é aparado; a senha, jamais. Espaço é caractere legítimo de senha,
    // e cortá-lo em silêncio recusaria quem escolheu usar um.
    aparaEmail(this.form.controls.email);

    if (this.form.invalid) {
      this.form.markAllAsTouched();
      return;
    }

    this.erro.set(null);
    this.contas.set([]);
    this.enviando.set(true);

    const { email, password } = this.form.getRawValue();

    this.auth.login(accountId ? { email, password, accountId } : { email, password }).subscribe({
      next: (resposta) => {
        this.enviando.set(false);
        void this.router.navigateByUrl(this.destino(resposta.session));
      },
      error: (erro: unknown) => {
        this.enviando.set(false);
        this.tratar(erro);
      },
    });
  }

  /** A pessoa escolheu a consultoria: reenvia sem pedir a senha de novo. */
  escolherConta(conta: AccountChoice): void {
    this.submit(conta.id);
  }

  private destino(session: SessionUser): string {
    return this.returnUrl() ?? rotaDeEntrada(session);
  }

  private tratar(erro: unknown): void {
    if (!(erro instanceof HttpErrorResponse)) {
      this.erro.set(FALHA_GENÉRICA);
      return;
    }

    if (erro.status === 409) {
      const corpo = erro.error as AmbiguousLoginResponse | null;
      this.contas.set(corpo?.accounts ?? []);
      return;
    }

    if (erro.status === 401) {
      // A mensagem vem da API e é única de propósito: dizer qual dos dois campos
      // estava errado seria confirmar quem tem conta em qual consultoria.
      const corpo = erro.error as { message?: string } | null;
      this.erro.set(corpo?.message ?? 'E-mail ou senha inválidos.');
      return;
    }

    // Um 429 do limite de tentativas dizia apenas "não foi possível entrar", e
    // a pessoa relia a própria senha procurando um erro que não estava lá.
    this.erro.set(mensagemDoServidor(erro, FALHA_GENÉRICA));
  }
}
