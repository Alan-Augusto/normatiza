/**
 * O refresh token viaja por dois transportes, e a API nasce aceitando os dois:
 *
 * - **Web** — cookie `httpOnly`, fora do alcance do JavaScript. Um XSS na página
 *   não consegue ler a sessão longa.
 * - **App de campo** (Capacitor) — cabeçalho, com o token no *secure storage* do
 *   aparelho. Não há cookie de terceiros confiável ali.
 */
export const REFRESH_COOKIE = 'normatiza_rt';
export const REFRESH_HEADER = 'x-refresh-token';

/**
 * Qual transporte usar não é adivinhado pelo servidor — o cliente declara.
 * Sem este cabeçalho, o refresh token sai **apenas** no cookie e nunca no corpo
 * da resposta; com ele, sai apenas no corpo e nenhum cookie é gravado.
 *
 * Ter os dois ao mesmo tempo seria o pior dos mundos: o token estaria no cookie
 * protegido *e* numa string que o JavaScript da página consegue ler.
 */
export const CLIENT_HEADER = 'x-client';
export const CLIENT_NATIVO = 'mobile';

export function usaTransporteNativo(headers: Record<string, unknown>): boolean {
  return headers[CLIENT_HEADER] === CLIENT_NATIVO;
}

export interface CookieOptions {
  httpOnly: true;
  secure: boolean;
  sameSite: 'lax' | 'none';
  path: string;
  maxAge: number;
}

/**
 * `SameSite` depende de onde a API e o front estão hospedados:
 *
 * - domínios irmãos (`admin.normatiza.com` + `api.normatiza.com`) compartilham o
 *   eTLD+1 e são *same-site* → `lax` basta;
 * - ambientes de preview (`*.web.app` + URL do Cloud Run) são *cross-site* → só
 *   funciona com `none`, que por sua vez exige `secure`.
 */
export function refreshCookieOptions(crossSite: boolean, maxAgeMs: number): CookieOptions {
  return {
    httpOnly: true,
    secure: crossSite || process.env.NODE_ENV === 'production',
    sameSite: crossSite ? 'none' : 'lax',
    // Restringe o envio à única rota que usa o refresh token.
    path: '/auth',
    maxAge: maxAgeMs,
  };
}
