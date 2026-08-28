import { Directive, TemplateRef, inject, input } from '@angular/core';

/**
 * Os três pedaços que cada tela declara na própria linguagem dela.
 *
 * São diretivas, e não `#refs`, por um motivo só: `ngTemplateContextGuard`.
 * Sem ele, o `let-item` de um template projetado chega como `any`, e `any`
 * desliga o compilador em silêncio — foi assim que `ROLE_LABEL[papel]` passou
 * a compilar indexado por `any`, sem nenhum aviso, até virar erro em produção.
 */
@Directive({ selector: 'ng-template[appCabecalho]', standalone: true })
export class CabecalhoDaTabela {
  readonly template = inject(TemplateRef);
}

@Directive({ selector: 'ng-template[appLinha]', standalone: true })
export class LinhaDaTabela<T> {
  readonly template = inject<TemplateRef<{ $implicit: T }>>(TemplateRef);

  /**
   * A mesma coleção passada em `[dados]`. Repetir parece redundante e não é:
   * é daqui que o compilador tira o tipo de `let-item`. É o mesmo recurso que
   * o `ngFor` usa, pela mesma razão.
   */
  readonly appLinhaDe = input.required<readonly T[]>();

  static ngTemplateContextGuard<T>(
    _diretiva: LinhaDaTabela<T>,
    _contexto: unknown,
  ): _contexto is { $implicit: T } {
    return true;
  }
}

/** O que fazer quando não há nada — opcional, e só aparece na tela vazia. */
@Directive({ selector: 'ng-template[appAcaoVazia]', standalone: true })
export class AcaoVazia {
  readonly template = inject(TemplateRef);
}
