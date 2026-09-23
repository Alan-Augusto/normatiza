/**
 * O que o jsdom não traz e o PrimeNG precisa.
 *
 * `matchMedia` não existe no jsdom, e os componentes do PrimeNG a consultam
 * para decidir comportamento responsivo — sem ela, montar um `p-select` ou um
 * `p-dialog` num teste explode antes de a tela renderizar. É polyfill de
 * ambiente, não de produção: no navegador a função é nativa.
 */
if (!window.matchMedia) {
  window.matchMedia = (query: string): MediaQueryList =>
    ({
      matches: false,
      media: query,
      onchange: null,
      addListener: () => {},
      removeListener: () => {},
      addEventListener: () => {},
      removeEventListener: () => {},
      dispatchEvent: () => false,
    }) as MediaQueryList;
}

/**
 * `scrollIntoView` também falta. O `p-select` a chama ao abrir a lista com um
 * valor já escolhido, para trazer a opção marcada à vista — sem ela, escolher
 * pela segunda vez num teste lança fora do teste e contamina a suíte inteira.
 */
if (!Element.prototype.scrollIntoView) {
  Element.prototype.scrollIntoView = () => {};
}
