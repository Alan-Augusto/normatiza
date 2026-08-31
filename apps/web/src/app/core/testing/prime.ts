import { ComponentFixture } from '@angular/core/testing';

/**
 * Como se aperta um componente do PrimeNG num teste.
 *
 * Um `p-select` não é um `<select>`: ele monta a própria lista, e escrever
 * `.value = 'MANAGER'` nele não faz nada. Estas funções existem para que o
 * teste continue falando de intenção — "escolha Gestor" — sem espalhar por
 * dezenas de arquivos o conhecimento de que a opção é um `<li role="option">`.
 *
 * Se um dia a biblioteca mudar esse detalhe, o conserto é aqui, uma vez.
 */

/** O overlay do PrimeNG é montado dentro do próprio componente (`appendTo: 'self'`). */
function raiz(fixture: ComponentFixture<unknown>): HTMLElement {
  return fixture.nativeElement as HTMLElement;
}

export function elemento(fixture: ComponentFixture<unknown>, seletor: string): HTMLElement | null {
  return raiz(fixture).querySelector(seletor);
}

export function elementos(fixture: ComponentFixture<unknown>, seletor: string): HTMLElement[] {
  return Array.from(raiz(fixture).querySelectorAll(seletor));
}

/**
 * O que um campo de escolha **apresenta**, na ordem em que aparece.
 *
 * Devolve os **rótulos**, não os valores: é o que a pessoa lê. Um teste que
 * afirmasse `['TECHNICIAN']` estaria conferindo o enum do banco; o que importa
 * é que a Carla vê "Técnico" e mais nada.
 *
 * Lê duas formas, porque o sistema tem duas e a **regra é a mesma nas duas**:
 * um `p-select`, que precisa ser aberto, e uma lista marcada com `data-opcao`
 * — que inclui o caso de **um papel só**, onde não há escolha a fazer e o
 * formulário informa em vez de perguntar (D21).
 *
 * > O risco de um ajudante que lê duas formas é ele passar mesmo se a tela
 * > ficasse muda. Por isso cada forma tem um teste próprio afirmando a forma;
 * > aqui só se afirma a **regra**, que não muda com o desenho.
 */
export function opcoesDe(fixture: ComponentFixture<unknown>, testid: string): string[] {
  const declaradas = elementos(fixture, `[data-testid="${testid}"] [data-opcao]`);
  if (declaradas.length > 0) {
    return declaradas.map((opcao) => opcao.getAttribute('data-opcao') ?? '');
  }

  abrir(fixture, testid);
  const opcoes = elementos(fixture, 'li[role="option"]').map(
    (opcao) => opcao.getAttribute('aria-label') ?? '',
  );
  fechar(fixture, testid);
  return opcoes;
}

/** Escolhe pelo rótulo que a pessoa leria, na forma que o campo tiver. */
export function escolher(fixture: ComponentFixture<unknown>, testid: string, rotulo: string): void {
  const naLista = elementos(fixture, `[data-testid="${testid}"] [data-opcao]`);

  if (naLista.length > 0) {
    const alvo = naLista.find((item) => item.getAttribute('data-opcao') === rotulo);
    if (!alvo) throw new Error(naoOferecido(rotulo, testid, opcoesDe(fixture, testid)));

    // O rótulo embrulha o rádio; clicar nele é o que a pessoa faz.
    const entrada = alvo.querySelector('input');
    (entrada ?? alvo).click();
    fixture.detectChanges();
    return;
  }

  abrir(fixture, testid);

  const opcao = elementos(fixture, 'li[role="option"]').find(
    (item) => item.getAttribute('aria-label') === rotulo,
  );

  if (!opcao) {
    const oferecidas = elementos(fixture, 'li[role="option"]').map(
      (i) => i.getAttribute('aria-label') ?? '',
    );
    throw new Error(naoOferecido(rotulo, testid, oferecidas));
  }

  opcao.click();
  fixture.detectChanges();
}

function naoOferecido(rotulo: string, testid: string, oferecidas: string[]): string {
  return `"${rotulo}" não é oferecido em [${testid}]. Há: ${oferecidas.join(', ')}`;
}

/**
 * Marca ou desmarca um `p-checkbox`. O clique vai no `<input>` interno, que é
 * onde o componente escuta — clicar na casinha desenhada não faria nada.
 */
export function marcar(fixture: ComponentFixture<unknown>, inputId: string, marcado = true): void {
  const entrada = elemento(fixture, `#${inputId}`) as HTMLInputElement | null;
  if (!entrada) throw new Error(`Não achei a caixa "${inputId}".`);

  if (entrada.checked !== marcado) {
    entrada.click();
    fixture.detectChanges();
  }
}

/** Digita num campo de texto — `pInputText` e `pTextarea` são diretivas sobre o nativo. */
export function digitar(fixture: ComponentFixture<unknown>, seletor: string, valor: string): void {
  const campo = elemento(fixture, seletor) as HTMLInputElement | HTMLTextAreaElement | null;
  if (!campo) throw new Error(`Não achei o campo "${seletor}".`);

  campo.value = valor;
  campo.dispatchEvent(new Event('input'));
  fixture.detectChanges();
}

export function clicar(fixture: ComponentFixture<unknown>, seletor: string): void {
  const alvo = elemento(fixture, seletor);
  if (!alvo) throw new Error(`Não achei "${seletor}" para clicar.`);

  alvo.click();
  fixture.detectChanges();
}

/**
 * O `p-button` renderiza um `<button>` **dentro** do elemento marcado, e é ele
 * quem carrega o `disabled`. Perguntar ao `<p-button>` sempre devolveria
 * `undefined` — e um teste que verifica trava travaria de mentira.
 */
export function estaDesabilitado(fixture: ComponentFixture<unknown>, seletor: string): boolean {
  const alvo = elemento(fixture, seletor);
  if (!alvo) throw new Error(`Não achei "${seletor}".`);

  const botao = alvo instanceof HTMLButtonElement ? alvo : alvo.querySelector('button');
  if (!botao) throw new Error(`"${seletor}" não é um botão.`);

  return botao.disabled;
}

function abrir(fixture: ComponentFixture<unknown>, testid: string): void {
  const select = elemento(fixture, `[data-testid="${testid}"]`);
  if (!select) throw new Error(`Não achei o seletor "${testid}".`);

  if (!elemento(fixture, 'li[role="option"]')) {
    select.click();
    fixture.detectChanges();
  }
}

function fechar(fixture: ComponentFixture<unknown>, testid: string): void {
  const select = elemento(fixture, `[data-testid="${testid}"]`);
  if (select && elemento(fixture, 'li[role="option"]')) {
    select.click();
    fixture.detectChanges();
  }
}
