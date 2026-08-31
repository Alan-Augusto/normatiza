import { NgTemplateOutlet } from '@angular/common';
import { ChangeDetectionStrategy, Component, computed, contentChild, input } from '@angular/core';
import { Skeleton } from 'primeng/skeleton';
import { TableModule } from 'primeng/table';

import {
  AcaoVazia,
  CabecalhoDaTabela,
  LinhaDaTabela,
  TituloDeGrupo,
} from './data-table.directives';

/**
 * A tabela de todas as telas.
 *
 * O que ela encapsula **não** é a marcação — é a decisão sobre os três estados
 * que toda lista tem e que nenhuma tela lembrava de ter: carregando, vazia e
 * com dados. Antes desta, as três telas mostravam zero linha em silêncio nos
 * três casos, e "ainda buscando", "não existe nada" e "a requisição falhou"
 * ficavam visualmente idênticos.
 *
 * Ela é dirigida por **template**, e não por configuração. Um
 * `[colunas]="[{campo: 'name'}]"` parece mais limpo por duas semanas, até a
 * primeira coluna que precisa de um badge — aí nasce `cellTemplate`, depois
 * `formatter`, e no fim se reinventou a sintaxe de template do Angular, pior e
 * sem verificação de tipo, porque `campo: 'name'` é uma string que ninguém
 * confere.
 *
 * O `p-table` continua embaixo, à vista: o que se encapsula é a decisão sobre
 * ele, não o acesso a ele.
 */
@Component({
  selector: 'app-data-table',
  standalone: true,
  imports: [NgTemplateOutlet, Skeleton, TableModule],
  templateUrl: './data-table.component.html',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class DataTable<T> {
  /**
   * Mutável, e não `readonly T[]`: é o que o `value` do `p-table` aceita, e
   * fingir imutabilidade aqui só empurraria uma cópia por ciclo de detecção
   * para dentro do template.
   */
  readonly dados = input.required<T[]>();

  /**
   * Verdadeiro enquanto a primeira carga não chegou. Separado de "vazio" de
   * propósito: são respostas diferentes para quem olha — uma pede espera, a
   * outra pede ação.
   */
  readonly carregando = input(false);

  /** O título da tela vazia. Diz o que não há, na língua daquela tela. */
  readonly vazio = input('Nada por aqui ainda.');

  /** A linha de apoio: por que está vazio, ou o que fazer a respeito. */
  readonly vazioDetalhe = input<string | undefined>(undefined);

  readonly linhasDeEsqueleto = input(5);

  /**
   * O campo que abre os grupos, quando a lista responde melhor em blocos que
   * corrida (D22). Sem ele, nada muda.
   *
   * **É um nome de campo em string — justo o que o resto do componente evita.**
   * A razão é que quem agrupa é o `p-table`, e é assim que ele pede. A troca
   * vale porque aqui a string nomeia **um** campo e falha alto (grupo nenhum
   * aparece), enquanto uma configuração de colunas nomearia todas e falharia
   * caladamente, célula a célula. O conteúdo do título continua sendo template.
   *
   * Os dados precisam chegar **já ordenados** por esse campo: o `p-table` abre
   * um grupo a cada troca de valor, e uma lista fora de ordem produziria o
   * mesmo título três vezes.
   */
  readonly agruparPor = input<string | undefined>(undefined);

  protected readonly cabecalho = contentChild.required(CabecalhoDaTabela);
  protected readonly linha = contentChild.required(LinhaDaTabela);
  protected readonly acaoVazia = contentChild(AcaoVazia);
  protected readonly tituloDeGrupo = contentChild(TituloDeGrupo);

  /** Só agrupa quando há campo **e** título — meio agrupamento não é nenhum. */
  protected readonly agrupando = computed(() => !!this.agruparPor() && !!this.tituloDeGrupo());

  protected readonly esqueleto = computed(() =>
    Array.from({ length: this.linhasDeEsqueleto() }, (_, i) => i),
  );
}
