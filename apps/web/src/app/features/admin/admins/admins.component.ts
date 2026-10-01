import { DatePipe } from '@angular/common';
import { Component, computed, inject, signal } from '@angular/core';
import { Button } from 'primeng/button';
import { Message } from 'primeng/message';
import { tap } from 'rxjs';

import type { PlatformAdmin } from '@normatiza/shared';

import { AuthService } from '../../../core/auth/auth.service';
import { PlatformAdminService } from './services/platform-admin.service';
import { mensagemDoServidor } from '../../../core/http/mensagem-de-erro';
import { DataTable } from '../../../shared/components/data-table/data-table.component';
import {
  CabecalhoDaTabela,
  LinhaDaTabela,
} from '../../../shared/components/data-table/data-table.directives';
import { RowActionComponent } from '../../../shared/components/row-action/row-action.component';
import { ConcederAdminComponent } from './components/conceder-admin.component';
import { ModalService } from '@core/modal/modal.service';

/**
 * Admins da Plataforma — Contexto 0.
 *
 * Quem administra o produto, não quem administra uma consultoria. Ser admin
 * não é papel de vínculo: é uma dimensão sobreposta ao login que a pessoa já
 * tem — o dono do produto é Engenheiro Responsável da consultoria dele **e**
 * admin da plataforma, com um login só.
 *
 * A concessão é por **e-mail exato** (D19). Não há busca por trecho, e a razão
 * não é sigilo — o Contexto 0 enxerga as contas por definição: é que uma busca
 * parcial seria uma varredura do cadastro inteiro, e quem promove alguém já
 * sabe o endereço dessa pessoa.
 *
 * Quando o mesmo e-mail alcança duas pessoas em consultorias diferentes, o
 * servidor devolve 409 com os candidatos e quem concede escolhe. Promover "a
 * primeira que aparecer" daria acesso total à pessoa errada, em silêncio.
 */
@Component({
  selector: 'app-admin-admins',
  standalone: true,
  imports: [
    RowActionComponent,
    DatePipe,
    Button,
    Message,
    DataTable,
    CabecalhoDaTabela,
    LinhaDaTabela,
  ],
  templateUrl: './admins.component.html',
  styleUrl: './admins.component.css',
})
export class AdminsComponent {
  private readonly platformAdmins = inject(PlatformAdminService);
  private readonly modal = inject(ModalService);
  private readonly auth = inject(AuthService);

  readonly admins = signal<PlatformAdmin[]>([]);
  readonly carregando = signal(false);
  readonly erro = signal<string | null>(null);

  readonly euMesmo = computed(() => this.auth.session()?.user.id);

  constructor() {
    this.carregar();
  }

  async abrirConcessao(): Promise<void> {
    const ref = this.modal.abrir<boolean>(ConcederAdminComponent, { titulo: 'Conceder acesso de admin' });
    if (await ref.fechado) this.carregar();
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

  /** Ação destrutiva: confirma antes (docs/web/design_system.md §6). */
  revogar(admin: PlatformAdmin): void {
    void this.modal.confirmar({
      titulo: 'Revogar acesso de admin',
      texto: `**${admin.name}** deixa de enxergar o backoffice da plataforma. O login e os vínculos com a consultoria continuam como estão.`,
      confirmar: 'Revogar acesso',
      testid: 'confirmar-revogacao',
      acao: () =>
        this.platformAdmins.revoke(admin.userId).pipe(
          tap({
            next: () => this.carregar(),
            error: (falha: unknown) => this.erro.set(mensagemDoServidor(falha, 'Não foi possível revogar o acesso.')),
          }),
        ),
    });
  }
}
