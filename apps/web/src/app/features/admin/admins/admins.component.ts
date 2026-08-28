import { DatePipe } from '@angular/common';
import { HttpErrorResponse } from '@angular/common/http';
import { Component, computed, inject, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { Button } from 'primeng/button';
import { Dialog } from 'primeng/dialog';
import { InputText } from 'primeng/inputtext';
import { Message } from 'primeng/message';

import type {
  AmbiguousGrantResponse,
  PlatformAdmin,
  PlatformAdminCandidate,
} from '@normatiza/shared';

import { AuthService } from '../../../core/auth/auth.service';
import { PlatformAdminService } from './services/platform-admin.service';
import { mensagemDoServidor } from '../../../core/http/mensagem-de-erro';
import { DataTable } from '../../../shared/components/data-table/data-table.component';
import {
  CabecalhoDaTabela,
  LinhaDaTabela,
} from '../../../shared/components/data-table/data-table.directives';

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
    DatePipe,
    FormsModule,
    Button,
    Dialog,
    InputText,
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
  private readonly auth = inject(AuthService);

  readonly admins = signal<PlatformAdmin[]>([]);
  readonly carregando = signal(false);
  readonly erro = signal<string | null>(null);

  readonly euMesmo = computed(() => this.auth.session()?.user.id);

  readonly concedendo = signal(false);
  readonly email = signal('');
  readonly concedendoEmAndamento = signal(false);
  readonly erroDaConcessao = signal<string | null>(null);

  /**
   * Os candidatos do desempate. Vazio na primeira tentativa; preenchido quando
   * o servidor respondeu 409 porque o e-mail alcança mais de uma pessoa.
   */
  readonly candidatos = signal<PlatformAdminCandidate[]>([]);

  constructor() {
    this.carregar();
  }

  abrirConcessao(): void {
    this.email.set('');
    this.candidatos.set([]);
    this.erroDaConcessao.set(null);
    this.concedendo.set(true);
  }

  conceder(userId?: string): void {
    const email = this.email().trim();
    if (!email) return;

    this.erroDaConcessao.set(null);
    this.concedendoEmAndamento.set(true);

    this.platformAdmins.grant({ email, ...(userId ? { userId } : {}) }).subscribe({
      next: () => {
        this.concedendoEmAndamento.set(false);
        this.concedendo.set(false);
        this.carregar();
      },
      error: (falha: unknown) => {
        this.concedendoEmAndamento.set(false);

        // 409 não é falha: é o servidor perguntando qual das pessoas é.
        if (falha instanceof HttpErrorResponse && falha.status === 409) {
          const corpo = falha.error as AmbiguousGrantResponse | null;
          this.candidatos.set(corpo?.candidates ?? []);
          return;
        }

        this.erroDaConcessao.set(
          mensagemDoServidor(falha, 'Não foi possível conceder o acesso agora.'),
        );
      },
    });
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
