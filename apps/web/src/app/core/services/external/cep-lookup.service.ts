import { HttpClient } from '@angular/common/http';
import { Injectable, inject } from '@angular/core';
import { Observable, catchError, map, of, switchMap, throwError, timeout } from 'rxjs';

import { isValidCep, onlyDigits } from '@normatiza/shared';

export interface CepLookupResult {
  street?: string;
  district?: string;
  city?: string;
  state?: string;
}

interface RespostaBrasilApi {
  street?: string;
  neighborhood?: string;
  city?: string;
  state?: string;
}

interface RespostaViaCep {
  erro?: boolean | string;
  logradouro?: string;
  bairro?: string;
  localidade?: string;
  uf?: string;
}

/**
 * Consulta de CEP: BrasilAPI primeiro, ViaCEP se ela não responder. As duas
 * gratuitas e sem chave, as duas isoladas aqui — e nenhuma obrigatória: se
 * ambas falharem, o endereço se digita.
 */
@Injectable({ providedIn: 'root' })
export class CepLookupService {
  private readonly http = inject(HttpClient);

  lookup(cep: string): Observable<CepLookupResult | null> {
    if (!isValidCep(cep)) return of(null);
    const digitos = onlyDigits(cep);

    return this.http.get<RespostaBrasilApi>(`https://brasilapi.com.br/api/cep/v2/${digitos}`).pipe(
      timeout(5000),
      map((r) => limpar({ street: r.street, district: r.neighborhood, city: r.city, state: r.state })),
      catchError(() =>
        this.http.get<RespostaViaCep>(`https://viacep.com.br/ws/${digitos}/json/`).pipe(
          timeout(5000),
          // O ViaCEP responde 200 com `erro: true` para CEP que não existe.
          switchMap((r) => (r.erro ? throwError(() => new Error('CEP inexistente')) : of(r))),
          map((r) => limpar({ street: r.logradouro, district: r.bairro, city: r.localidade, state: r.uf })),
        ),
      ),
      catchError(() => of(null)),
    );
  }
}

function limpar(campos: CepLookupResult): CepLookupResult {
  return Object.fromEntries(
    Object.entries(campos).filter(([, valor]) => typeof valor === 'string' && valor.trim() !== ''),
  ) as CepLookupResult;
}
