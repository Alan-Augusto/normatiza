import { Component, computed, inject, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { Button } from 'primeng/button';
import { InputText } from 'primeng/inputtext';
import { Message } from 'primeng/message';
import { Select } from 'primeng/select';

import {
  MENSAGEM_SENHA_CURTA,
  ROLE_LABEL,
  ROLE_LIMIT,
  ROLE_SUMMARY,
  SENHA_MINIMA,
  hasProfessionalRegistry,
  type RegistryType,
  type UpdateProfileRequest,
} from '@normatiza/shared';

import { AuthService } from '../../../core/auth/auth.service';
import { ProfileService } from './services/profile.service';
import { mensagemDoServidor } from '../../../core/http/mensagem-de-erro';

/**
 * Meu Perfil.
 *
 * A única tela que todo mundo tem, de qualquer papel e de qualquer lado — e por
 * isso o lugar onde a pessoa entende **o que ela é no sistema**. É a razão de
 * os vínculos aparecerem aqui, e não apenas numa tela de administração que ela
 * não abre.
 *
 * Os dados vêm da sessão, sem uma segunda ida à rede: quem está logado já
 * carrega o próprio cadastro desde o login.
 */
@Component({
  selector: 'app-profile',
  standalone: true,
  imports: [FormsModule, Button, InputText, Message, Select],
  templateUrl: './profile.component.html',
  styleUrl: './profile.component.css',
})
export class ProfileComponent {
  private readonly auth = inject(AuthService);
  private readonly profile = inject(ProfileService);

  readonly rotulo = ROLE_LABEL;
  readonly resumo = ROLE_SUMMARY;
  readonly limite = ROLE_LIMIT;

  /** O mesmo mínimo que o servidor exige — importado dele, nunca copiado. */
  readonly tamanhoMinimo = SENHA_MINIMA;

  readonly opcoesDeConselho = [
    { label: 'CREA', value: 'CREA' },
    { label: 'CFT', value: 'CFT' },
  ];

  private readonly sessao = this.auth.session;
  readonly usuario = computed(() => this.sessao()?.user);
  readonly vinculos = computed(() =>
    (this.sessao()?.memberships ?? []).filter((vinculo) => vinculo.isActive),
  );

  /**
   * CREA/CFT é de quem assina responsabilidade técnica ([03 §3.3]). Perguntá-lo
   * ao Executor é pedir um documento que ele não tem por que ter.
   */
  readonly pedeRegistro = computed(() =>
    hasProfessionalRegistry(this.vinculos().flatMap((vinculo) => vinculo.roles)),
  );

  readonly nome = signal(this.usuario()?.name ?? '');
  readonly telefone = signal(this.usuario()?.phone ?? '');
  readonly cargo = signal(this.usuario()?.jobTitle ?? '');
  readonly tipoDeRegistro = signal<RegistryType>(this.usuario()?.registryType ?? 'CREA');
  readonly numeroDeRegistro = signal(this.usuario()?.registryNumber ?? '');

  readonly salvandoPerfil = signal(false);
  readonly erroDoPerfil = signal<string | null>(null);
  readonly avisoDoPerfil = signal<string | null>(null);

  readonly senhaAtual = signal('');
  readonly senhaNova = signal('');
  readonly salvandoSenha = signal(false);
  readonly erroDaSenha = signal<string | null>(null);
  readonly avisoDaSenha = signal<string | null>(null);

  salvarPerfil(): void {
    this.salvandoPerfil.set(true);
    this.erroDoPerfil.set(null);
    this.avisoDoPerfil.set(null);

    // Campos escolhidos um a um. **`email` não entra** (D7): o servidor recusa o
    // corpo inteiro se ele vier, e mandá-lo "só para constar" viraria um 400 em
    // cima de quem preencheu tudo certo.
    const dados: UpdateProfileRequest = {
      name: this.nome().trim(),
      phone: this.telefone().trim(),
      jobTitle: this.cargo().trim(),
      ...(this.pedeRegistro() && this.numeroDeRegistro().trim()
        ? { registryType: this.tipoDeRegistro(), registryNumber: this.numeroDeRegistro().trim() }
        : {}),
    };

    this.profile.updateProfile(dados).subscribe({
      next: () => {
        this.salvandoPerfil.set(false);
        this.avisoDoPerfil.set('Cadastro salvo.');
        this.auth.atualizarPerfil(dados);
      },
      error: (falha: unknown) => {
        this.salvandoPerfil.set(false);
        this.erroDoPerfil.set(mensagemDoServidor(falha, 'Não foi possível salvar o cadastro.'));
      },
    });
  }

  salvarSenha(): void {
    this.erroDaSenha.set(null);
    this.avisoDaSenha.set(null);

    // Sessão válida não basta: uma aba esquecida aberta não pode trocar a
    // credencial permanente de alguém.
    if (!this.senhaAtual().trim()) {
      this.erroDaSenha.set('Informe a senha atual para confirmar a troca.');
      return;
    }
    if (!this.senhaNova().trim()) {
      this.erroDaSenha.set('Informe a senha nova.');
      return;
    }
    if (this.senhaNova().length < SENHA_MINIMA) {
      this.erroDaSenha.set(MENSAGEM_SENHA_CURTA);
      return;
    }

    this.salvandoSenha.set(true);
    this.profile
      .changePassword({ currentPassword: this.senhaAtual(), newPassword: this.senhaNova() })
      .subscribe({
        next: () => {
          this.salvandoSenha.set(false);
          this.senhaAtual.set('');
          this.senhaNova.set('');
          this.avisoDaSenha.set('Senha alterada.');
        },
        error: (falha: unknown) => {
          this.salvandoSenha.set(false);
          this.erroDaSenha.set(mensagemDoServidor(falha, 'Não foi possível trocar a senha.'));
        },
      });
  }
}
