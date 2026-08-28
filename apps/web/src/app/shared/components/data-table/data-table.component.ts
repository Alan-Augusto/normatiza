import { NgTemplateOutlet } from '@angular/common';
import { ChangeDetectionStrategy, Component, computed, contentChild, input } from '@angular/core';
import { Skeleton } from 'primeng/skeleton';
import { TableModule } from 'primeng/table';

import { AcaoVazia, CabecalhoDaTabela, LinhaDaTabela } from './data-table.directives';

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

  protected readonly cabecalho = contentChild.required(CabecalhoDaTabela);
  protected readonly linha = contentChild.required(LinhaDaTabela);
  protected readonly acaoVazia = contentChild(AcaoVazia);

  protected readonly esqueleto = computed(() =>
    Array.from({ length: this.linhasDeEsqueleto() }, (_, i) => i),
  );
}
