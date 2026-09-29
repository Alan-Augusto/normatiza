import { NgTemplateOutlet } from '@angular/common';
import {
  ChangeDetectionStrategy,
  Component,
  ElementRef,
  computed,
  contentChild,
  input,
  model,
  output,
  signal,
  viewChild,
} from '@angular/core';
import { NgIcon, provideIcons } from '@ng-icons/core';
import {
  lucideChevronLeft,
  lucideChevronRight,
  lucideChevronsLeft,
  lucideChevronsRight,
  lucideSearch,
  lucideX,
} from '@ng-icons/lucide';
import { Skeleton } from 'primeng/skeleton';
import { TableModule } from 'primeng/table';

import {
  AcaoPrimaria,
  AcaoVazia,
  CabecalhoDaTabela,
  FiltrosAtivos,
  FiltrosAvancados,
  FiltrosRapidos,
  LinhaDaTabela,
  TituloDeGrupo,
  ToolbarEsquerda,
  VisualizacaoCustomizada,
} from './data-table.directives';

/**
 * A tabela compartilhada com suporte a Toolbar Integrada e Paginação Completa.
 *
 * Encapsula:
 * 1. Os 3 estados: Carregando (Skeleton em cascata), Vazia (com título/detalhe/ação) e Com dados.
 * 2. Toolbar moderna (estilo Linear / shadcn): totalizador, chips ativos, filtros rápidos com micro-badges, busca fluida expansível e CTA.
 * 3. Paginação parametrizada (front-end ou back-end) com layout full-height, scroll interno e cabeçalho sticky.
 * 4. Dirigida por template e tipada via signals.
 */
@Component({
  selector: 'app-data-table',
  standalone: true,
  imports: [NgTemplateOutlet, Skeleton, TableModule, NgIcon],
  providers: [
    provideIcons({
      lucideSearch,
      lucideX,
      lucideChevronLeft,
      lucideChevronRight,
      lucideChevronsLeft,
      lucideChevronsRight,
    }),
  ],
  templateUrl: './data-table.component.html',
  styleUrl: './data-table.component.css',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class DataTable<T> {
  /** Mutável para compatibilidade com o p-table. */
  readonly dados = input.required<T[]>();

  /** Verdadeiro enquanto a primeira carga não chegou. */
  readonly carregando = input(false);

  /** O título da tela vazia. */
  readonly vazio = input('Nada por aqui ainda.');

  /** A linha de apoio para a tela vazia. */
  readonly vazioDetalhe = input<string | undefined>(undefined);

  readonly linhasDeEsqueleto = input(5);

  /** Campo para agrupamento de linhas. */
  readonly agruparPor = input<string | undefined>(undefined);

  // ── Paginação ──────────────────────────────────────────────────────────────

  /** Se a paginação está ativa (padrão true). */
  readonly paginado = input(true);

  /**
   * Modo de paginação:
   * - 'front': fatiamento dos dados no cliente (padrão)
   * - 'back': os dados já vêm fatiados do servidor; a tabela apenas controla a navegação
   */
  readonly modoPaginacao = input<'front' | 'back'>('front');

  /** Página atual (1-indexada). Two-way bindable via [(pagina)]. */
  readonly pagina = model<number>(1);

  /** Quantidade de itens por página. Two-way bindable via [(itensPorPagina)]. */
  readonly itensPorPagina = model<number>(15);

  /** Opções do seletor de itens por página. */
  readonly opcoesItensPorPagina = input<number[]>([10, 15, 25, 50, 100]);

  /**
   * Total de itens a exibir no contador e calcular páginas. Se omitido,
   * utiliza `dados().length`.
   */
  readonly total = input<number | undefined>(undefined);

  /** Total original irrestrito (opcional, para exibir "(de X no total)"). */
  readonly totalOriginal = input<number | undefined>(undefined);

  /** Nome no plural da entidade para o contador e seletor (ex.: "empresas", "equipamentos"). */
  readonly entidade = input<string | undefined>(undefined);

  // ── Toolbar Integrada ──────────────────────────────────────────────────────

  /**
   * Termo da busca. Se passado (mesmo que string vazia `''`), ativa a busca
   * expansível fluida integrada à toolbar.
   */
  readonly termoBusca = input<string | undefined>(undefined);

  /** Placeholder do campo de busca. */
  readonly placeholderBusca = input('Buscar…');

  /** Notifica quando o usuário digita na busca. */
  readonly buscaChange = output<string>();

  // ── Slots e Diretivas ──────────────────────────────────────────────────────

  protected readonly cabecalho = contentChild.required(CabecalhoDaTabela);
  protected readonly linha = contentChild.required(LinhaDaTabela);
  protected readonly acaoVazia = contentChild(AcaoVazia);
  protected readonly tituloDeGrupo = contentChild(TituloDeGrupo);

  protected readonly filtrosRapidos = contentChild(FiltrosRapidos);
  protected readonly filtrosAvancados = contentChild(FiltrosAvancados);
  protected readonly filtrosAtivos = contentChild(FiltrosAtivos);
  protected readonly toolbarEsquerda = contentChild(ToolbarEsquerda);
  protected readonly acaoPrimaria = contentChild(AcaoPrimaria);
  protected readonly visualizacaoCustomizada = contentChild(VisualizacaoCustomizada);

  // ── Estado Interno da Busca Expansível ──────────────────────────────────────

  protected readonly campoBusca = viewChild<ElementRef<HTMLInputElement>>('campoBusca');
  protected readonly buscaAberta = signal(false);

  protected readonly buscaAtiva = computed(
    () => this.buscaAberta() || !!this.termoBusca(),
  );

  // ── Computeds de Paginação e Dados ─────────────────────────────────────────

  protected readonly totalRegistros = computed(() => this.total() ?? this.dados().length);

  protected readonly totalExibido = computed(() => this.totalRegistros());

  protected readonly totalPaginas = computed(() => {
    const total = this.totalRegistros();
    const itens = this.itensPorPagina();
    if (total === 0 || itens <= 0) return 1;
    return Math.ceil(total / itens);
  });

  protected readonly paginaValida = computed(() => {
    const total = this.totalPaginas();
    const pag = this.pagina();
    return Math.max(1, Math.min(pag, total));
  });

  protected readonly indiceInicial = computed(() => {
    const total = this.totalRegistros();
    if (total === 0) return 0;
    return (this.paginaValida() - 1) * this.itensPorPagina() + 1;
  });

  protected readonly indiceFinal = computed(() => {
    const total = this.totalRegistros();
    if (total === 0) return 0;
    return Math.min(this.paginaValida() * this.itensPorPagina(), total);
  });

  protected readonly dadosExibidos = computed(() => {
    if (!this.paginado()) return this.dados();
    if (this.modoPaginacao() === 'back') {
      return this.dados();
    }
    const inicio = (this.paginaValida() - 1) * this.itensPorPagina();
    return this.dados().slice(inicio, inicio + this.itensPorPagina());
  });

  protected readonly temToolbar = computed(
    () =>
      this.entidade() !== undefined ||
      this.total() !== undefined ||
      this.termoBusca() !== undefined ||
      !!this.filtrosRapidos() ||
      !!this.filtrosAvancados() ||
      !!this.filtrosAtivos() ||
      !!this.toolbarEsquerda() ||
      !!this.acaoPrimaria(),
  );

  protected readonly agrupando = computed(() => !!this.agruparPor() && !!this.tituloDeGrupo());

  protected readonly esqueleto = computed(() =>
    Array.from({ length: this.linhasDeEsqueleto() }, (_, i) => i),
  );

  // ── Ações de Paginação ─────────────────────────────────────────────────────

  protected irParaPagina(p: number): void {
    const destino = Math.max(1, Math.min(p, this.totalPaginas()));
    if (destino !== this.pagina()) {
      this.pagina.set(destino);
    }
  }

  protected primeiraPagina(): void {
    this.irParaPagina(1);
  }

  protected paginaAnterior(): void {
    this.irParaPagina(this.paginaValida() - 1);
  }

  protected proximaPagina(): void {
    this.irParaPagina(this.paginaValida() + 1);
  }

  protected ultimaPagina(): void {
    this.irParaPagina(this.totalPaginas());
  }

  protected mudarItensPorPagina(qtd: number): void {
    this.itensPorPagina.set(qtd);
    this.irParaPagina(1);
  }

  // ── Ações de Busca ─────────────────────────────────────────────────────────

  protected abrirBusca(): void {
    this.buscaAberta.set(true);
    setTimeout(() => this.campoBusca()?.nativeElement.focus(), 50);
  }

  protected aoDigitarBusca(valor: string): void {
    this.buscaChange.emit(valor);
  }

  protected limparBusca(event: Event): void {
    event.stopPropagation();
    this.buscaChange.emit('');
    this.campoBusca()?.nativeElement.focus();
  }

  protected fecharOuLimparBusca(): void {
    if (this.termoBusca()) {
      this.buscaChange.emit('');
    } else {
      this.buscaAberta.set(false);
    }
  }

  protected aoSairDaBusca(): void {
    if (!this.termoBusca()) {
      this.buscaAberta.set(false);
    }
  }
}
