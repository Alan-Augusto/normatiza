import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { TestBed } from '@angular/core/testing';
import { firstValueFrom } from 'rxjs';

import { CepLookupService } from './cep-lookup.service';

describe('CepLookupService', () => {
  let service: CepLookupService;
  let http: HttpTestingController;

  const BRASIL_API = 'https://brasilapi.com.br/api/cep/v2/01310100';
  const VIA_CEP = 'https://viacep.com.br/ws/01310100/json/';

  beforeEach(() => {
    TestBed.configureTestingModule({
      providers: [provideHttpClient(), provideHttpClientTesting()],
    });
    service = TestBed.inject(CepLookupService);
    http = TestBed.inject(HttpTestingController);
  });

  afterEach(() => http.verify());

  it('deve preencher o endereço pela BrasilAPI', async () => {
    const promessa = firstValueFrom(service.lookup('01310-100'));

    http.expectOne(BRASIL_API).flush({
      cep: '01310100',
      state: 'SP',
      city: 'São Paulo',
      neighborhood: 'Bela Vista',
      street: 'Avenida Paulista',
    });

    expect(await promessa).toEqual({
      street: 'Avenida Paulista',
      district: 'Bela Vista',
      city: 'São Paulo',
      state: 'SP',
    });
  });

  it('deve tentar o ViaCEP quando a BrasilAPI não responde', async () => {
    const promessa = firstValueFrom(service.lookup('01310100'));

    http.expectOne(BRASIL_API).flush('', { status: 500, statusText: 'Erro' });
    http.expectOne(VIA_CEP).flush({
      logradouro: 'Avenida Paulista',
      bairro: 'Bela Vista',
      localidade: 'São Paulo',
      uf: 'SP',
    });

    expect((await promessa)?.city).toBe('São Paulo');
  });

  it('deve responder vazio quando os dois falham, ou o CEP não existe', async () => {
    const promessa = firstValueFrom(service.lookup('01310100'));

    http.expectOne(BRASIL_API).flush('', { status: 404, statusText: 'Não encontrado' });
    // O ViaCEP responde 200 com `erro: true` para CEP que não existe.
    http.expectOne(VIA_CEP).flush({ erro: true });

    expect(await promessa).toBeNull();
  });

  it('não deve consultar CEP incompleto', async () => {
    expect(await firstValueFrom(service.lookup('0131'))).toBeNull();
    http.expectNone(() => true);
  });
});
