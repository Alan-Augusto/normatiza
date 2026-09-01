/**
 * Produção. `apiBaseUrl` é **vazio de propósito**: web e API são servidos pela
 * mesma origem (o nginx de `apps/web/nginx.conf` encaminha os prefixos da API),
 * então as chamadas saem como caminhos relativos — `/auth/login`, `/users`.
 *
 * Duas consequências, ambas desejadas:
 *
 * 1. A imagem não sabe em que domínio vai rodar. Trocar de servidor, de domínio
 *    ou subir um ambiente de staging não exige rebuild do front.
 * 2. Mesma origem significa ausência de CORS e cookie `SameSite=Lax` — o
 *    `Path=/auth` do refresh token funciona sem `COOKIE_CROSS_SITE`.
 *
 * Se um dia a API mudar para um host próprio (`api.exemplo.com`), este valor
 * volta a ser uma URL absoluta E o `COOKIE_CROSS_SITE=true` passa a ser
 * obrigatório na API.
 */
export const environment = {
  production: true,
  apiBaseUrl: '',
};
