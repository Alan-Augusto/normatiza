import { HttpErrorResponse } from '@angular/common/http';
import { Component, OnInit, computed, inject, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { RouterLink } from '@angular/router';
import { Button } from 'primeng/button';
import { Dialog } from 'primeng/dialog';
import { InputText } from 'primeng/inputtext';
import { Message } from 'primeng/message';
import { Select } from 'primeng/select';
import { Textarea } from 'primeng/textarea';

import { canEditInventory, type CompanyMember, type SectorListItem } from '@normatiza/shared';

import { AuthService } from '../../../../../core/auth/auth.service';
import { mensagemDoServidor } from '../../../../../core/http/mensagem-de-erro';
import { empresaDaRota } from '../../../../../core/routing/empresa-da-rota';
import { ROTAS } from '../../../../../core/routing/rotas';
import { InventoryService } from '../../../../../core/services/inventory.service';
import { TeamService } from '../../../../../core/services/team.service';
import { DataTable } from '../../../../../shared/components/data-table/data-table.component';
import {
  AcaoPrimaria,
  AcaoVazia,
  CabecalhoDaTabela,
  LinhaDaTabela,
} from '../../../../../shared/components/data-table/data-table.directives';
import { RowActionComponent } from '../../../../../shared/components/row-action/row-action.component';

interface Edicao {
  setor: SectorListItem;
  nome: string;
  descricao: string;
  responsavel: string | null;
}

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
    Dialog,
    InputText,
    Message,
    Select,
    Textarea,
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
  private readonly team = inject(TeamService);
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

  readonly editando = signal<Edicao | null>(null);
  readonly erroDoNome = signal<string | null>(null);
  readonly membros = signal<CompanyMember[]>([]);

  readonly mesclando = signal<SectorListItem | null>(null);
  readonly destinoDaMescla = signal<string | null>(null);

  readonly excluindo = signal<SectorListItem | null>(null);
  readonly processando = signal(false);

  readonly podeCriar = computed(() => {
    const empresa = this.empresa();
    return !!empresa && canEditInventory(this.auth.rolesInCompany(empresa.id), empresa.status === 'INACTIVE');
  });

  readonly opcoesDeResponsavel = computed(() =>
    this.membros()
      .filter((m) => m.status === 'ACTIVE')
      .map((m) => ({ label: m.name, value: m.id })),
  );

  /** Os setores que podem receber a mescla: todos menos o que sai. */
  readonly destinos = computed(() => this.setores().filter((s) => s.id !== this.mesclando()?.id));

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

  abrirEdicao(setor: SectorListItem): void {
    this.erroDoNome.set(null);
    this.editando.set({
      setor,
      nome: setor.name,
      descricao: setor.description ?? '',
      responsavel: setor.responsible?.id ?? null,
    });

    // O responsável é alguém com acesso à empresa. Sem a lista, o campo some,
    // e o resto da edição continua.
    const empresa = this.empresa();
    if (empresa && this.membros().length === 0) {
      this.team.listCompanyMembers(empresa.id).subscribe({
        next: (equipe) => this.membros.set(equipe.members),
        error: () => this.membros.set([]),
      });
    }
  }

  alterarEdicao(mudança: Partial<Edicao>): void {
    const atual = this.editando();
    if (atual) this.editando.set({ ...atual, ...mudança });
  }

  salvarEdicao(): void {
    const edicao = this.editando();
    const empresa = this.empresa();
    if (!edicao || !empresa) return;

    this.processando.set(true);
    this.erroDoNome.set(null);
    this.inventory
      .updateSector(empresa.id, edicao.setor.id, {
        name: edicao.nome,
        description: edicao.descricao,
        responsibleUserId: edicao.responsavel,
      })
      .subscribe({
        next: () => {
          this.processando.set(false);
          this.editando.set(null);
          this.carregar();
        },
        error: (erro) => {
          this.processando.set(false);
          const campo = erro instanceof HttpErrorResponse ? (erro.error as { field?: string })?.field : undefined;
          const mensagem = mensagemDoServidor(erro, 'Não foi possível salvar o setor.');
          if (campo === 'name') this.erroDoNome.set(mensagem);
          else this.erro.set(mensagem);
        },
      });
  }

  abrirMescla(setor: SectorListItem): void {
    this.destinoDaMescla.set(null);
    this.mesclando.set(setor);
  }

  confirmarMescla(): void {
    const origem = this.mesclando();
    const destino = this.destinoDaMescla();
    const empresa = this.empresa();
    if (!origem || !destino || !empresa) return;

    this.executar(() => this.inventory.mergeSector(empresa.id, origem.id, destino), this.mesclando, 'mesclar');
  }

  confirmarExclusao(): void {
    const setor = this.excluindo();
    const empresa = this.empresa();
    if (!setor || !empresa) return;

    this.executar(() => this.inventory.removeSector(empresa.id, setor.id), this.excluindo, 'excluir');
  }

  private executar(
    operação: () => ReturnType<InventoryService['removeSector']>,
    alvo: typeof this.excluindo,
    verbo: string,
  ): void {
    this.processando.set(true);
    operação().subscribe({
      next: () => {
        this.processando.set(false);
        alvo.set(null);
        this.carregar();
      },
      error: (erro) => {
        this.processando.set(false);
        alvo.set(null);
        this.erro.set(mensagemDoServidor(erro, `Não foi possível ${verbo} o setor.`));
      },
    });
  }

  equipamentos(n: number): string {
    return n === 1 ? '1 equipamento' : `${n} equipamentos`;
  }
}
