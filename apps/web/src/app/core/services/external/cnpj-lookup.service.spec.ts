import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { TestBed } from '@angular/core/testing';
import { firstValueFrom } from 'rxjs';

import { CnpjLookupService } from './cnpj-lookup.service';

/**
 * A consulta de CNPJ na BrasilAPI. O que importa aqui é o contrato **para a
 * tela**: o que chega preenchido, e que falha nunca derruba ninguém — se a API
 * externa não responde, a pessoa digita.
 */
describe('CnpjLookupService', () => {
  let service: CnpjLookupService;
  let http: HttpTestingController;

  beforeEach(() => {
    TestBed.configureTestingModule({
      providers: [provideHttpClient(), provideHttpClientTesting()],
    });
    service = TestBed.inject(CnpjLookupService);
    http = TestBed.inject(HttpTestingController);
  });

  afterEach(() => http.verify());

  it('deve consultar só pelos dígitos e traduzir a resposta para os campos do formulário', async () => {
    const promessa = firstValueFrom(service.lookup('44.444.444/0001-91'));

    http.expectOne('https://brasilapi.com.br/api/cnpj/v1/44444444000191').flush({
      razao_social: 'JBS S.A.',
      nome_fantasia: 'JBS',
      cep: '01310100',
      logradouro: 'AVENIDA PAULISTA',
      numero: '1000',
      complemento: 'ANDAR 5',
      bairro: 'BELA VISTA',
      municipio: 'SAO PAULO',
      uf: 'SP',
      email: 'CONTATO@JBS.COM',
      ddd_telefone_1: '1133330000',
    });

    expect(await promessa).toEqual({
      corporateName: 'JBS S.A.',
      tradeName: 'JBS',
      zipCode: '01310100',
      street: 'AVENIDA PAULISTA',
      number: '1000',
      complement: 'ANDAR 5',
      district: 'BELA VISTA',
      city: 'SAO PAULO',
      state: 'SP',
    });
  });

  it('não deve inventar campo que a Receita deixou em branco', async () => {
    const promessa = firstValueFrom(service.lookup('44444444000191'));

    http.expectOne(() => true).flush({ razao_social: 'JBS S.A.', nome_fantasia: '', complemento: '' });

    expect(await promessa).toEqual({ corporateName: 'JBS S.A.' });
  });

  it('deve responder vazio, e não erro, quando a consulta falha', async () => {
    const promessa = firstValueFrom(service.lookup('44444444000191'));

    http.expectOne(() => true).flush('fora do ar', { status: 502, statusText: 'Bad Gateway' });

    expect(await promessa).toBeNull();
  });

  it('não deve consultar CNPJ inválido — a cota da API é por IP e não se gasta à toa', async () => {
    expect(await firstValueFrom(service.lookup('44.444.444/0001-92'))).toBeNull();
    http.expectNone(() => true);
  });
});
