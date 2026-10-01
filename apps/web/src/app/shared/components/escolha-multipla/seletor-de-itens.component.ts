import { ChangeDetectionStrategy, Component, computed, inject, input, OnInit, signal } from '@angular/core';
import { NgIconComponent, provideIcons } from '@ng-icons/core';
import { lucideChevronRight, lucideSearch } from '@ng-icons/lucide';
import { Button } from 'primeng/button';
import { InputText } from 'primeng/inputtext';

import { ModalRef } from '@core/modal/modal-ref';

import { normalizar, type GrupoDeEscolha } from './escolha';

/**
 * Até aqui, tudo aberto: origens (82), consequências (68) e proteções (28) se
 * leem de uma vez. Só as normas (857) começam com as seções fechadas.
 */
const POUCOS_ITENS = 150;

/**
 * O corpo do modal de escolha múltipla (docs/web/design_system.md §10): busca,
 * os grupos do catálogo e, em cada linha, a caixa de marcar, o código em
 * destaque e o texto inteiro, quebrando linha — itens de norma chegam a três
 * mil caracteres, e um select de uma linha só os cortava.
 *
 * Com o catálogo grande (857 itens de norma), os grupos começam fechados: abrem
 * no clique, na busca, e quando já têm item escolhido.
 */
@Component({
  selector: 'app-seletor-de-itens',
  standalone: true,
  imports: [Button, InputText, NgIconComponent],
  providers: [provideIcons({ lucideSearch, lucideChevronRight })],
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: './seletor-de-itens.component.html',
  styleUrl: './seletor-de-itens.component.css',
})
export class SeletorDeItensComponent implements OnInit {
  protected readonly ref = inject<ModalRef<string[]>>(ModalRef);

  readonly grupos = input.required<GrupoDeEscolha[]>();
  readonly escolhidos = input<string[]>([]);
  readonly buscaPlaceholder = input('Buscar');

  protected readonly marcados = signal<ReadonlySet<string>>(new Set());
  protected readonly busca = signal('');
  /** O que a pessoa abriu e fechou à mão, por cima da regra. */
  private readonly abertosAMao = signal<ReadonlySet<string>>(new Set());
  private readonly fechadosAMao = signal<ReadonlySet<string>>(new Set());

  private readonly total = computed(() => this.grupos().reduce((n, g) => n + g.itens.length, 0));

  /** Os grupos com o que a busca acha; sem busca, todos. */
  protected readonly visiveis = computed(() => {
    const termo = normalizar(this.busca().trim());
    return this.grupos()
      .map((g) => ({
        ...g,
        itens: termo ? g.itens.filter((i) => normalizar(`${i.codigo ?? ''} ${i.texto}`).includes(termo)) : g.itens,
      }))
      .filter((g) => g.itens.length);
  });

  protected readonly quantos = computed(() => this.marcados().size);

  ngOnInit(): void {
    this.marcados.set(new Set(this.escolhidos()));
  }

  protected aberto(titulo: string): boolean {
    if (this.busca().trim()) return true;
    if (this.fechadosAMao().has(titulo)) return false;
    if (this.abertosAMao().has(titulo) || this.total() <= POUCOS_ITENS) return true;
    return !!this.grupos()
      .find((g) => g.titulo === titulo)
      ?.itens.some((i) => this.marcados().has(i.id));
  }

  protected alternarGrupo(titulo: string): void {
    const abrir = !this.aberto(titulo);
    const tirar = (lista: ReadonlySet<string>) => new Set([...lista].filter((t) => t !== titulo));
    this.abertosAMao.update((l) => (abrir ? new Set([...l, titulo]) : tirar(l)));
    this.fechadosAMao.update((l) => (abrir ? tirar(l) : new Set([...l, titulo])));
  }

  protected marcadosNoGrupo(grupo: GrupoDeEscolha): number {
    return grupo.itens.filter((i) => this.marcados().has(i.id)).length;
  }

  protected alternar(id: string): void {
    this.marcados.update((atual) => {
      const novo = new Set(atual);
      if (novo.has(id)) novo.delete(id);
      else novo.add(id);
      return novo;
    });
  }

  protected limpar(): void {
    this.marcados.set(new Set());
  }

  /** Na ordem do catálogo, e não na do clique: é a ordem em que o laudo os lista. */
  protected confirmar(): void {
    const marcados = this.marcados();
    this.ref.fechar(this.grupos().flatMap((g) => g.itens.filter((i) => marcados.has(i.id)).map((i) => i.id)));
  }
}
