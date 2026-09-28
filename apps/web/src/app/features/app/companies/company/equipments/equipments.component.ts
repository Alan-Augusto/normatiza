import { DatePipe, DecimalPipe } from '@angular/common';
import { Component, DestroyRef, OnInit, computed, inject, signal } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { FormsModule } from '@angular/forms';
import { ActivatedRoute, Router, RouterLink } from '@angular/router';
import { NgIconComponent, provideIcons } from '@ng-icons/core';
import { lucideBox, lucideLayoutGrid, lucideList, lucideSearch } from '@ng-icons/lucide';
import { Button, ButtonDirective, ButtonLabel } from 'primeng/button';
import { Dialog } from 'primeng/dialog';
import { InputText } from 'primeng/inputtext';
import { Message } from 'primeng/message';
import { Select } from 'primeng/select';
import { Subject, debounceTime, distinctUntilChanged } from 'rxjs';

import {
  EQUIPMENT_COMPLIANCE_LABEL,
  EQUIPMENT_STATUS_LABEL,
  canEditInventory,
  parseEquipmentCode,
  type EquipmentListItem,
  type EquipmentListQuery,
  type EquipmentStatus,
  type SectorListItem,
} from '@normatiza/shared';

import { AuthService } from '../../../../../core/auth/auth.service';
import { mensagemDoServidor } from '../../../../../core/http/mensagem-de-erro';
import { empresaDaRota } from '../../../../../core/routing/empresa-da-rota';
import { ROTAS } from '../../../../../core/routing/rotas';
import { InventoryService } from '../../../../../core/services/inventory.service';
import { DataTable } from '../../../../../shared/components/data-table/data-table.component';
import {
  AcaoVazia,
  CabecalhoDaTabela,
  LinhaDaTabela,
} from '../../../../../shared/components/data-table/data-table.directives';
import { RowActionComponent } from '../../../../../shared/components/row-action/row-action.component';

type Vista = 'tabela' | 'cartoes';

/**
 * Inventário da planta — Contexto 2 (docs/produto/03 §4.2).
 *
 * Em **tabela** para operar em volume, e em **cartões** quando a foto é a
 * informação — é assim que se reconhece a máquina no chão da fábrica. Os
 * cartões carregam a miniatura, nunca o original.
 *
 * A URL é a fonte do estado da lista, como na carteira de empresas: busca,
 * setor, situação e a vista escolhida. Voltar de dentro de uma máquina
 * encontra o inventário como estava.
 */
@Component({
  selector: 'app-equipments',
  standalone: true,
  imports: [
    DatePipe,
    DecimalPipe,
    FormsModule,
    RouterLink,
    NgIconComponent,
    Button,
    ButtonDirective,
    ButtonLabel,
    Dialog,
    InputText,
    Message,
    Select,
    DataTable,
    CabecalhoDaTabela,
    LinhaDaTabela,
    AcaoVazia,
    RowActionComponent,
  ],
  providers: [provideIcons({ lucideSearch, lucideBox, lucideList, lucideLayoutGrid })],
  templateUrl: './equipments.component.html',
  styleUrl: './equipments.component.css',
})
export class EquipmentsComponent implements OnInit {
  protected readonly rotas = ROTAS;

  private readonly inventory = inject(InventoryService);
  private readonly auth = inject(AuthService);
  private readonly route = inject(ActivatedRoute);
  private readonly router = inject(Router);
  private readonly destroyRef = inject(DestroyRef);

  private readonly empresa = empresaDaRota();

  readonly equipamentos = signal<EquipmentListItem[]>([]);
  readonly setores = signal<SectorListItem[]>([]);
  readonly carregando = signal(false);
  readonly erro = signal<string | null>(null);

  readonly filtros = signal<EquipmentListQuery>({});
  readonly vista = signal<Vista>('tabela');
  /** O texto no campo — separado do filtro aplicado, que espera a pessoa parar de digitar. */
  readonly termo = signal('');
  /** O código que o formulário acabou de cadastrar, para a confirmação no topo. */
  private readonly cadastrado = signal<string | null>(null);

  readonly desativando = signal<EquipmentListItem | null>(null);
  readonly excluindo = signal<EquipmentListItem | null>(null);
  readonly processando = signal(false);

  private readonly digitado = new Subject<string>();

  readonly opcoesDeStatus: { label: string; value: EquipmentStatus | 'ALL' }[] = [
    { label: 'Desativados', value: 'INACTIVE' },
    { label: 'Todos, inclusive desativados', value: 'ALL' },
  ];

  readonly opcoesDeSetor = computed(() => this.setores().map((s) => ({ label: s.name, value: s.id })));

  readonly rotasDaEmpresa = computed(() => ROTAS.empresa(this.empresa()?.slug ?? ''));

  /**
   * Quem cadastra vê o botão; quem só acompanha, não. Empresa inativa é modo
   * leitura. O servidor decide igual e revalida no envio.
   */
  readonly podeCadastrar = computed(() => {
    const empresa = this.empresa();
    if (!empresa) return false;
    return canEditInventory(this.auth.rolesInCompany(empresa.id), empresa.status === 'INACTIVE');
  });

  readonly buscando = computed(() => {
    const f = this.filtros();
    return !!f.q || !!f.sectorId || !!f.status;
  });

  readonly tituloDoVazio = computed(() =>
    this.buscando() ? 'Nenhum equipamento encontrado.' : 'Nenhum equipamento cadastrado.',
  );

  readonly detalheDoVazio = computed(() =>
    this.buscando()
      ? 'Tente outro termo — a busca olha código, nome, TAG, série, patrimônio, modelo e fabricante.'
      : this.podeCadastrar()
        ? 'Cadastre a primeira máquina da planta. Só o nome é obrigatório; a ficha completa vem na análise.'
        : 'Quando a consultoria ou a equipe da planta cadastrarem as máquinas, elas aparecem aqui.',
  );

  readonly confirmacao = computed(() => {
    const code = this.cadastrado();
    if (!code) return null;
    const equipamento = this.equipamentos().find((e) => e.code === code);
    return equipamento ? `${equipamento.code} · ${equipamento.name} cadastrado.` : null;
  });

  ngOnInit(): void {
    this.route.queryParamMap.pipe(takeUntilDestroyed(this.destroyRef)).subscribe((params) => {
      const q = params.get('q') ?? '';
      const status = params.get('status') as EquipmentListQuery['status'] | null;
      this.filtros.set({ q: q || undefined, sectorId: params.get('setor') ?? undefined, status: status ?? undefined });
      this.vista.set(params.get('vista') === 'cartoes' ? 'cartoes' : 'tabela');
      this.cadastrado.set(parseEquipmentCode(params.get('cadastrado') ?? ''));
      this.termo.set(q);
      this.carregar();
    });

    const empresa = this.empresa();
    if (empresa) {
      this.inventory.listSectors(empresa.id).subscribe({
        next: (setores) => this.setores.set(setores),
        // Sem setores o filtro some; a lista continua.
        error: () => this.setores.set([]),
      });
    }

    // Uma busca por tecla gastaria o servidor com "p", "pr", "pre"…
    this.digitado
      .pipe(debounceTime(300), distinctUntilChanged(), takeUntilDestroyed(this.destroyRef))
      .subscribe((q) => this.aplicar({ q: q.trim() || null }));
  }

  carregar(): void {
    const empresa = this.empresa();
    if (!empresa) return;
    this.carregando.set(true);
    this.erro.set(null);

    this.inventory.listEquipments(empresa.id, this.filtros()).subscribe({
      next: (equipamentos) => {
        this.equipamentos.set(equipamentos);
        this.carregando.set(false);
      },
      error: () => {
        this.carregando.set(false);
        this.erro.set('Não foi possível carregar o inventário.');
      },
    });
  }

  aoDigitar(valor: string): void {
    this.termo.set(valor);
    this.digitado.next(valor);
  }

  filtrarSetor(setor: string | null): void {
    this.aplicar({ setor });
  }

  filtrarStatus(status: EquipmentListQuery['status'] | null): void {
    this.aplicar({ status: status ?? null });
  }

  mudarVista(vista: Vista): void {
    this.aplicar({ vista: vista === 'cartoes' ? 'cartoes' : null });
  }

  /**
   * O filtro vai para a URL, e a URL recarrega a lista — um caminho só. A
   * confirmação do cadastro sai na primeira mudança: ela é daquele momento.
   */
  private aplicar(mudança: Record<string, string | null>): void {
    void this.router.navigate([], {
      relativeTo: this.route,
      queryParams: { ...mudança, cadastrado: null },
      queryParamsHandling: 'merge',
      replaceUrl: true,
    });
  }

  painelDe(equipamento: EquipmentListItem): string {
    return this.rotasDaEmpresa().equipamento(equipamento.code).painel;
  }

  editarDe(equipamento: EquipmentListItem): string {
    return this.rotasDaEmpresa().equipamento(equipamento.code).editar;
  }

  /**
   * Clique na linha entra na máquina — menos quando ele foi num controle da
   * própria linha ou terminou uma seleção de texto: quem arrasta para copiar
   * uma TAG não quer ser levado embora.
   */
  entrar(equipamento: EquipmentListItem, evento: MouseEvent): void {
    const alvo = evento.target as HTMLElement | null;
    if (alvo?.closest('a, button, input, [role="button"]')) return;
    if (window.getSelection()?.toString()) return;
    void this.router.navigateByUrl(this.painelDe(equipamento));
  }

  rotuloDoStatus(status: EquipmentStatus): string {
    return EQUIPMENT_STATUS_LABEL[status];
  }

  rotuloDaConformidade(equipamento: EquipmentListItem): string {
    return EQUIPMENT_COMPLIANCE_LABEL[equipamento.complianceStatus];
  }

  confirmarDesativar(): void {
    this.executar(this.desativando, (companyId, code) => this.inventory.deactivateEquipment(companyId, code), 'desativar');
  }

  confirmarExcluir(): void {
    this.executar(this.excluindo, (companyId, code) => this.inventory.removeEquipment(companyId, code), 'excluir');
  }

  reativar(equipamento: EquipmentListItem): void {
    const empresa = this.empresa();
    if (!empresa) return;
    this.inventory.reactivateEquipment(empresa.id, equipamento.code).subscribe({
      next: () => this.carregar(),
      error: (erro) => this.erro.set(mensagemDoServidor(erro, 'Não foi possível reativar o equipamento.')),
    });
  }

  private executar(
    alvo: typeof this.desativando,
    operação: (companyId: string, code: string) => ReturnType<InventoryService['deactivateEquipment']>,
    verbo: string,
  ): void {
    const equipamento = alvo();
    const empresa = this.empresa();
    if (!equipamento || !empresa) return;

    this.processando.set(true);
    operação(empresa.id, equipamento.code).subscribe({
      next: () => {
        this.processando.set(false);
        alvo.set(null);
        this.carregar();
      },
      error: (erro) => {
        this.processando.set(false);
        alvo.set(null);
        this.erro.set(mensagemDoServidor(erro, `Não foi possível ${verbo} o equipamento.`));
      },
    });
  }
}
