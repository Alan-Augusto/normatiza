import { HttpErrorResponse, HttpInterceptorFn, HttpRequest } from '@angular/common/http';
import { inject } from '@angular/core';
import { Router } from '@angular/router';
import { catchError, switchMap, throwError } from 'rxjs';

import { API_BASE_URL } from './api.config';
import { AuthService } from './auth.service';

/**
 * Rotas em que um `401` é a resposta, não um sintoma.
 *
 * Senha errada não é sessão expirada, e refresh recusado é o fim da sessão —
 * não um caso de renovar de novo. Tentar refresh em qualquer uma delas trocaria
 * o erro real por uma segunda falha, ou entraria em laço contra a API.
 */
const ROTAS_DE_CREDENCIAL = [
  '/auth/login',
  '/auth/refresh',
  '/auth/forgot-password',
  '/auth/reset-password',
  '/invitations/accept',
];

/**
 * O que torna os 15 minutos do access token invisíveis para quem usa o sistema:
 * a chamada que expira é renovada e repetida sem que a tela pisque.
 */
export const authInterceptor: HttpInterceptorFn = (req, next) => {
  const api = inject(API_BASE_URL);

  // Um CEP, um mapa, um CDN — nada disso tem por que receber a credencial da
  // sessão só porque a chamada passou pelo mesmo HttpClient.
  if (!req.url.startsWith(api)) return next(req);

  const auth = inject(AuthService);
  const router = inject(Router);

  return next(comCredenciais(req, auth.token())).pipe(
    catchError((erro: unknown) => {
      const expirou = erro instanceof HttpErrorResponse && erro.status === 401;
      const éCredencial = ROTAS_DE_CREDENCIAL.some((rota) => req.url.includes(rota));

      // `403` é permissão insuficiente, e nenhum token novo resolve isso.
      if (!expirou || éCredencial) return throwError(() => erro);

      return auth.refreshCompartilhado().pipe(
        // A repetição vai por `next`, que é o resto da cadeia — não volta a
        // passar por aqui. É o que garante uma tentativa de refresh por chamada,
        // em vez de um laço infinito quando o `401` persiste.
        switchMap(() => next(comCredenciais(req, auth.token()))),
        catchError((falha: unknown) => {
          auth.encerrarLocalmente();
          void router.navigate(['/login']);
          return throwError(() => falha);
        }),
      );
    }),
  );
};

/**
 * `withCredentials` vai em toda chamada da API porque o refresh token viaja em
 * cookie: sem ele o navegador descarta o `Set-Cookie` e a sessão morre no
 * primeiro recarregamento, sem erro visível nenhum.
 */
function comCredenciais<T>(req: HttpRequest<T>, token: string | null): HttpRequest<T> {
  return req.clone({
    withCredentials: true,
    setHeaders: token ? { Authorization: `Bearer ${token}` } : {},
  });
}
