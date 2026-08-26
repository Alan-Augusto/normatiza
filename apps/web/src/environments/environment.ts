/**
 * Desenvolvimento. Substituído por `environment.production.ts` no build de
 * produção (`fileReplacements` em `angular.json`).
 */
export const environment = {
  production: false,

  /**
   * A API responde na **raiz da própria origem**, não sob um prefixo `/api`.
   *
   * Não é detalhe de gosto: o cookie do refresh token é gravado com
   * `Path=/auth`, e o navegador só o devolve em URLs sob esse caminho. Servir a
   * API atrás de `/api` faria o cookie existir e nunca ser enviado — a sessão
   * morreria a cada recarregamento, sem erro nenhum na tela.
   */
  apiBaseUrl: 'http://localhost:3000',
};
