import { HttpClient } from '@angular/common/http';
import { Injectable, inject } from '@angular/core';
import { Observable, catchError, map, of, timeout } from 'rxjs';

import { isValidCnpj, onlyDigits } from '@normatiza/shared';

/** O que a consulta de CNPJ sabe preencher. Campo que a Receita não informou não vem. */
export interface CnpjLookupResult {
  corporateName?: string;
  tradeName?: string;
  zipCode?: string;
  street?: string;
  number?: string;
  complement?: string;
  district?: string;
  city?: string;
  state?: string;
}

interface RespostaBrasilApi {
  razao_social?: string;
  nome_fantasia?: string;
  cep?: string;
  logradouro?: string;
  numero?: string;
  complemento?: string;
  bairro?: string;
  municipio?: string;
  uf?: string;
}

/**
 * Consulta de CNPJ na BrasilAPI — gratuita, sem chave.
 *
 * **Integração externa mora aqui, e só aqui** (D25 do plano de empresas):
 * nenhum service do sistema chama API de terceiro. E ela nunca é a porta
 * obrigatória — falhou, o formulário segue aberto para digitar.
 *
 * Não leva credencial: o interceptor só anexa o token a chamadas da nossa API.
 */
@Injectable({ providedIn: 'root' })
export class CnpjLookupService {
  private readonly http = inject(HttpClient);

  lookup(cnpj: string): Observable<CnpjLookupResult | null> {
    // A cota é por IP: consulta de CNPJ que nem é CNPJ é cota gasta à toa.
    if (!isValidCnpj(cnpj)) return of(null);

    return this.http
      .get<RespostaBrasilApi>(`https://brasilapi.com.br/api/cnpj/v1/${onlyDigits(cnpj)}`)
      .pipe(
        timeout(6000),
        map(traduzir),
        catchError(() => of(null)),
      );
  }
}

function traduzir(r: RespostaBrasilApi): CnpjLookupResult {
  const campos: CnpjLookupResult = {
    corporateName: r.razao_social,
    tradeName: r.nome_fantasia,
    zipCode: r.cep ? onlyDigits(r.cep) : undefined,
    street: r.logradouro,
    number: r.numero,
    complement: r.complemento,
    district: r.bairro,
    city: r.municipio,
    state: r.uf,
  };

  // Vazio da Receita não é valor: sem isto, um nome fantasia em branco
  // apagaria o que a pessoa já tinha digitado — ou ocuparia o campo com nada.
  return Object.fromEntries(
    Object.entries(campos).filter(([, valor]) => typeof valor === 'string' && valor.trim() !== ''),
  ) as CnpjLookupResult;
}
