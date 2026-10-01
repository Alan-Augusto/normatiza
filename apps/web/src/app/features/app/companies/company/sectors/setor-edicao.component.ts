import { HttpErrorResponse } from '@angular/common/http';
import { Component, OnInit, computed, inject, input, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { Button } from 'primeng/button';
import { InputText } from 'primeng/inputtext';
import { Message } from 'primeng/message';
import { Select } from 'primeng/select';
import { Textarea } from 'primeng/textarea';

import type { CompanyMember, SectorListItem } from '@normatiza/shared';

import { mensagemDoServidor } from '../../../../../core/http/mensagem-de-erro';
import { ModalRef } from '../../../../../core/modal/modal-ref';
import { InventoryService } from '../../../../../core/services/inventory.service';
import { TeamService } from '../../../../../core/services/team.service';

/** Editar um setor — nome, descrição, responsável. Aberto pelo `ModalService`; fecha com `true` ao salvar. */
@Component({
  selector: 'app-setor-edicao',
  standalone: true,
  imports: [FormsModule, Button, InputText, Message, Select, Textarea],
  styleUrl: './setor-dialogos.css',
  template: `
    <form class="space-y-4" (ngSubmit)="salvar()">
      @if (erro()) {
        <p-message severity="error" styleClass="w-full" [text]="erro()!" />
      }
      <div class="campo">
        <label for="setor-nome">Nome</label>
        <input
          pInputText
          id="setor-nome"
          data-testid="campo-nome"
          name="nome"
          class="w-full"
          [(ngModel)]="nome"
          [attr.aria-describedby]="erroDoNome() ? 'erro-nome' : null"
        />
        <p id="erro-nome" data-testid="erro-nome" role="alert" class="erro">{{ erroDoNome() }}</p>
      </div>

      <div class="campo">
        <label for="setor-descricao">Descrição <span class="opcional">opcional</span></label>
        <textarea pTextarea id="setor-descricao" name="descricao" rows="2" class="w-full" [(ngModel)]="descricao"></textarea>
      </div>

      @if (opcoesDeResponsavel().length) {
        <div class="campo">
          <label for="setor-responsavel">Responsável <span class="opcional">opcional</span></label>
          <p-select
            inputId="setor-responsavel"
            name="responsavel"
            [options]="opcoesDeResponsavel()"
            [(ngModel)]="responsavel"
            optionLabel="label"
            optionValue="value"
            placeholder="Ninguém em especial"
            [showClear]="true"
            appendTo="body"
            styleClass="w-full"
          />
        </div>
      }

      <div class="flex justify-end gap-2">
        <p-button label="Cancelar" severity="secondary" [text]="true" (onClick)="ref.fechar()" />
        <p-button data-testid="salvar-setor" type="submit" label="Salvar" [loading]="processando()" />
      </div>
    </form>
  `,
})
export class SetorEdicaoComponent implements OnInit {
  protected readonly ref = inject<ModalRef<boolean>>(ModalRef);
  private readonly inventory = inject(InventoryService);
  private readonly team = inject(TeamService);

  readonly companyId = input.required<string>();
  readonly setor = input.required<SectorListItem>();

  protected nome = '';
  protected descricao = '';
  protected responsavel: string | null = null;
  protected readonly erroDoNome = signal<string | null>(null);
  protected readonly erro = signal<string | null>(null);
  protected readonly processando = signal(false);
  private readonly membros = signal<CompanyMember[]>([]);

  protected readonly opcoesDeResponsavel = computed(() =>
    this.membros()
      .filter((m) => m.status === 'ACTIVE')
      .map((m) => ({ label: m.name, value: m.id })),
  );

  ngOnInit(): void {
    const s = this.setor();
    this.nome = s.name;
    this.descricao = s.description ?? '';
    this.responsavel = s.responsible?.id ?? null;
    // O responsável é alguém com acesso à empresa. Sem a lista, o campo some, e o resto da edição continua.
    this.team.listCompanyMembers(this.companyId()).subscribe({
      next: (equipe) => this.membros.set(equipe.members),
      error: () => this.membros.set([]),
    });
  }

  protected salvar(): void {
    if (this.processando()) return;
    this.processando.set(true);
    this.erroDoNome.set(null);
    this.erro.set(null);
    this.inventory
      .updateSector(this.companyId(), this.setor().id, { name: this.nome, description: this.descricao, responsibleUserId: this.responsavel })
      .subscribe({
        next: () => this.ref.fechar(true),
        error: (erro) => {
          this.processando.set(false);
          const campo = erro instanceof HttpErrorResponse ? (erro.error as { field?: string })?.field : undefined;
          const mensagem = mensagemDoServidor(erro, 'Não foi possível salvar o setor.');
          if (campo === 'name') this.erroDoNome.set(mensagem);
          else this.erro.set(mensagem);
        },
      });
  }
}
