import { DatePipe } from '@angular/common';
import { Component, computed, inject, signal } from '@angular/core';
import { Button } from 'primeng/button';
import { Message } from 'primeng/message';
import { TableModule } from 'primeng/table';

import type { PlatformAdmin } from '@normatiza/shared';

import { AuthService } from '../../../core/auth/auth.service';
import { PlatformAdminService } from './services/platform-admin.service';
import { mensagemDoServidor } from '../../../core/http/mensagem-de-erro';

/**
 * Admins da Plataforma — Contexto 0.
 *
 * Quem administra o produto, não quem administra uma consultoria. Ser admin
 * não é papel de vínculo: é uma dimensão sobreposta ao login que a pessoa já
 * tem — o dono do produto é Engenheiro Responsável da consultoria dele **e**
 * admin da plataforma, com um login só.
 *
 * **Conceder ainda não existe aqui**, e a ausência é deliberada: a tela pedida
 * concede por e-mail, a API concede por `userId`, e não há consulta de pessoa
 * que atravesse contas — ela seria um oráculo capaz de responder "quem trabalha
 * na consultoria tal". É a decisão D19, e ela não se resolve no código.
 */
@Component({
  selector: 'app-admin-admins',
  standalone: true,
  imports: [DatePipe, Button, Message, TableModule],
  templateUrl: './admins.component.html',
  styleUrl: './admins.component.css',
})
export class AdminsComponent {
  private readonly platformAdmins = inject(PlatformAdminService);
  private readonly auth = inject(AuthService);

  readonly admins = signal<PlatformAdmin[]>([]);
  readonly carregando = signal(false);
  readonly erro = signal<string | null>(null);

  readonly euMesmo = computed(() => this.auth.session()?.user.id);

  constructor() {
    this.carregar();
  }

  carregar(): void {
    this.carregando.set(true);
    this.erro.set(null);

    this.platformAdmins.list().subscribe({
      next: (admins) => {
        this.admins.set(admins);
        this.carregando.set(false);
      },
      error: () => {
        this.carregando.set(false);
        this.erro.set('Não foi possível carregar os administradores.');
      },
    });
  }

  /**
   * Revogar a si mesmo não é oferecido. O servidor já recusa — ficar sem
   * nenhum admin é como se perde o Contexto 0 —, e oferecer o que será
   * recusado é ruído.
   */
  podeRevogar(admin: PlatformAdmin): boolean {
    return !admin.revokedAt && admin.userId !== this.euMesmo();
  }

  revogar(admin: PlatformAdmin): void {
    this.platformAdmins.revoke(admin.userId).subscribe({
      next: () => this.carregar(),
      error: (falha: unknown) =>
        this.erro.set(mensagemDoServidor(falha, 'Não foi possível revogar o acesso.')),
    });
  }
}
