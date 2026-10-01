import { Component, OnInit, computed, inject, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { RouterLink } from '@angular/router';
import { Button } from 'primeng/button';
import { InputText } from 'primeng/inputtext';
import { Message } from 'primeng/message';
import { tap } from 'rxjs';

import { canEditInventory, type SectorListItem } from '@normatiza/shared';

import { AuthService } from '../../../../../core/auth/auth.service';
import { mensagemDoServidor } from '../../../../../core/http/mensagem-de-erro';
import { ModalService } from '../../../../../core/modal/modal.service';
import { empresaDaRota } from '../../../../../core/routing/empresa-da-rota';
import { ROTAS } from '../../../../../core/routing/rotas';
import { InventoryService } from '../../../../../core/services/inventory.service';
import { DataTable } from '../../../../../shared/components/data-table/data-table.component';
import {
  AcaoPrimaria,
  AcaoVazia,
  CabecalhoDaTabela,
  LinhaDaTabela,
} from '../../../../../shared/components/data-table/data-table.directives';
import { RowActionComponent } from '../../../../../shared/components/row-action/row-action.component';
import { SetorEdicaoComponent } from './setor-edicao.component';
import { SetorMesclaComponent } from './setor-mescla.component';

/**
 * Setores da planta — Contexto 2 (docs/produto/03 §4.3).
 *
 * O setor nasce onde é preciso — aqui ou no formulário do equipamento — e o
 * nome é comparado sem acento nem caixa: digitar um que já existe devolve o
 * existente, e a tela diz qual era. O que o legado não deixava fazer, esta tela
 * faz: renomear e mesclar o setor errado no certo, com as máquinas junto.
 */
@Component({
  selector: 'app-sectors',
  standalone: true,
  imports: [
    FormsModule,
    RouterLink,
    Button,
    InputText,
    Message,
    DataTable,
    CabecalhoDaTabela,
    LinhaDaTabela,
    AcaoPrimaria,
    AcaoVazia,
    RowActionComponent,
  ],
  templateUrl: './sectors.component.html',
  styleUrl: './sectors.component.css',
})
export class SectorsComponent implements OnInit {
  private readonly inventory = inject(InventoryService);
  private readonly modal = inject(ModalService);
  private readonly auth = inject(AuthService);

  private readonly empresa = empresaDaRota();

  readonly setores = signal<SectorListItem[]>([]);
  readonly carregando = signal(false);
  readonly erro = signal<string | null>(null);
  readonly aviso = signal<string | null>(null);

  readonly termo = signal('');
  readonly novo = signal('');
  readonly criando = signal(false);

  readonly setoresFiltrados = computed(() => {
    const t = this.termo().toLowerCase().trim();
    if (!t) return this.setores();
    return this.setores().filter(
      (s) =>
        s.name.toLowerCase().includes(t) ||
        s.description?.toLowerCase().includes(t) ||
        s.responsible?.name.toLowerCase().includes(t),
    );
  });


  readonly podeCriar = computed(() => {
    const empresa = this.empresa();
    return !!empresa && canEditInventory(this.auth.rolesInCompany(empresa.id), empresa.status === 'INACTIVE');
  });

  ngOnInit(): void {
    this.carregar();
  }

  carregar(): void {
    const empresa = this.empresa();
    if (!empresa) return;
    this.carregando.set(true);

    this.inventory.listSectors(empresa.id).subscribe({
      next: (setores) => {
        this.setores.set(setores);
        this.carregando.set(false);
      },
      error: () => {
        this.carregando.set(false);
        this.erro.set('Não foi possível carregar os setores.');
      },
    });
  }

  aoDigitar(valor: string): void {
    this.termo.set(valor);
  }

  inventarioDo(setor: SectorListItem): { rota: string; params: Record<string, string> } {
    return { rota: ROTAS.empresa(this.empresa()?.slug ?? '').equipamentos, params: { setor: setor.id } };
  }

  criar(): void {
    const empresa = this.empresa();
    const nome = this.novo().trim();
    if (!empresa || !nome) return;

    this.criando.set(true);
    this.aviso.set(null);
    this.erro.set(null);
    this.inventory.createSector(empresa.id, { name: nome }).subscribe({
      next: (setor) => {
        this.criando.set(false);
        this.novo.set('');
        this.aviso.set(
          setor.existing
            ? `O setor "${setor.name}" já existia — nomes iguais sem acento ou caixa são o mesmo setor.`
            : `Setor "${setor.name}" criado.`,
        );
        this.carregar();
      },
      error: (erro) => {
        this.criando.set(false);
        this.erro.set(mensagemDoServidor(erro, 'Não foi possível criar o setor.'));
      },
    });
  }

  async abrirEdicao(setor: SectorListItem): Promise<void> {
    const empresa = this.empresa();
    if (!empresa) return;
    const ref = this.modal.abrir<boolean>(SetorEdicaoComponent, {
      titulo: `Editar ${setor.name}`,
      entradas: { companyId: empresa.id, setor },
    });
    if (await ref.fechado) this.carregar();
  }

  async abrirMescla(setor: SectorListItem): Promise<void> {
    const empresa = this.empresa();
    if (!empresa) return;
    const ref = this.modal.abrir<boolean>(SetorMesclaComponent, {
      titulo: `Mesclar ${setor.name}`,
      entradas: { companyId: empresa.id, origem: setor, setores: this.setores() },
    });
    if (await ref.fechado) this.carregar();
  }

  excluir(setor: SectorListItem): void {
    const empresa = this.empresa();
    if (!empresa) return;
    void this.modal.confirmar({
      titulo: `Excluir ${setor.name}`,
      texto: `O setor **${setor.name}** não tem equipamentos e será excluído.`,
      confirmar: 'Excluir setor',
      testid: 'confirmar-excluir',
      acao: () =>
        this.inventory.removeSector(empresa.id, setor.id).pipe(
          tap({
            next: () => this.carregar(),
            error: (erro) => this.erro.set(mensagemDoServidor(erro, 'Não foi possível excluir o setor.')),
          }),
        ),
    });
  }

  equipamentos(n: number): string {
    return n === 1 ? '1 equipamento' : `${n} equipamentos`;
  }
}
