import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { Component } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { Router, provideRouter } from '@angular/router';
import { RouterTestingHarness } from '@angular/router/testing';
import { firstValueFrom } from 'rxjs';

import type { CompanyUpsertRequest } from '@normatiza/shared';

import { API_BASE_URL } from '../../../../core/auth/api.config';
import { AuthService } from '../../../../core/auth/auth.service';
import { BRF, SEARA, respostaDeLogin, sessão, vínculo } from '../../../../core/auth/testing/sessao';
import { detalheDaBrf } from '../../../../core/services/testing/empresas';
import { escolher } from '../../../../core/testing/prime';
import { CompanyFormComponent } from './company-form.component';

@Component({ template: '' })
class Destino {}

/**
 * O formulário de empresa — o mesmo para cadastrar e para editar, em quatro
 * etapas ([03 §3.2](../../../../../../../../docs/produto/03_navegacao_e_telas.md)).
 *
 * O que se protege: obrigatório é obrigatório, o erro aparece ao lado do campo
 * que o causou, nada é salvo sem um clique no botão de salvar — nem por um
 * Enter esbarrado —, e as buscas automáticas ajudam sem travar o cadastro
 * quando o serviço externo está fora.
 */
describe('CompanyFormComponent', () => {
  let http: HttpTestingController;
  let harness: RouterTestingHarness;

  const API = 'http://api.teste';
  const CNPJ_API = 'https://brasilapi.com.br/api/cnpj/v1/44444444000191';
  const CEP_API = (cep: string) => `https://brasilapi.com.br/api/cep/v2/${cep}`;

  beforeEach(async () => {
    TestBed.configureTestingModule({
      providers: [
        provideRouter([
          { path: 'app/empresas', component: Destino },
          { path: 'app/empresas/nova', component: CompanyFormComponent },
          { path: 'app/empresas/:companyId/editar', component: CompanyFormComponent },
          { path: 'app/empresas/:companyId/painel', component: Destino },
          { path: 'app/empresas/:companyId/equipe', component: Destino },
        ]),
        provideHttpClient(),
        provideHttpClientTesting(),
        { provide: API_BASE_URL, useValue: API },
      ],
    });
    http = TestBed.inject(HttpTestingController);

    const auth = TestBed.inject(AuthService);
    const login = firstValueFrom(auth.login({ email: 'josue@email.com', password: 'certa' }));
    http
      .expectOne(`${API}/auth/login`)
      .flush(
        respostaDeLogin({
          session: sessão([vínculo(BRF.id, ['LEAD_ENGINEER']), vínculo(SEARA.id, ['LEAD_ENGINEER'])], false, true),
        }),
      );
    await login;
  });

  let gruposDaConta: string[] = [];
  beforeEach(() => (gruposDaConta = ['Grupo BRF', 'Grupo Aurora']));

  afterEach(() => http.verify());

  const raiz = () => harness.routeNativeElement as HTMLElement;
  const el = (seletor: string) => raiz().querySelector<HTMLElement>(seletor);
  // Um componente (o autocomplete do grupo) leva o testid no hospedeiro; o campo é o input dentro dele.
  const campo = (nome: string) => {
    const alvo = el(`[data-testid="campo-${nome}"]`);
    return (alvo?.matches('input, textarea') ? alvo : alvo?.querySelector('input')) as HTMLInputElement;
  };
  const grupos = (nomes: string[] = []) =>
    http.expectOne(`${API}/company-groups`).flush(nomes.map((name, i) => ({ id: `g-${i}`, name })));
  const erroDe = (nome: string) => el(`[data-testid="erro-${nome}"]`)?.textContent?.trim() ?? '';
  const esperar = (ms = 0) => new Promise((r) => setTimeout(r, ms));
  const etapaAtual = () => el('[data-testid="etapa-atual"]')?.getAttribute('data-etapa');

  function digitar(nome: string, valor: string, sair = true) {
    const entrada = campo(nome);
    entrada.value = valor;
    entrada.dispatchEvent(new Event('input'));
    if (sair) entrada.dispatchEvent(new Event('blur'));
    harness.detectChanges();
  }

  function clicar(testid: string) {
    const alvo = el(`[data-testid="${testid}"] button`) ?? el(`[data-testid="${testid}"]`);
    if (!alvo) throw new Error(`"${testid}" não está na tela.`);
    alvo.click();
    harness.detectChanges();
  }

  const avançar = () => clicar('avancar');
  const salvar = () => clicar('salvar');

  async function novo() {
    harness = await RouterTestingHarness.create();
    await harness.navigateByUrl('/app/empresas/nova', CompanyFormComponent);
    grupos(gruposDaConta);
  }

  async function editarBrf(detalhe = detalheDaBrf()) {
    harness = await RouterTestingHarness.create();
    await harness.navigateByUrl(`/app/empresas/${BRF.id}/editar`, CompanyFormComponent);
    grupos(gruposDaConta);
    http.expectOne(`${API}/companies/${BRF.id}`).flush(detalhe);
    harness.detectChanges();
    await harness.fixture.whenStable();
    harness.detectChanges();
  }

  function preencherIdentificação() {
    digitar('razao', 'JBS S.A.');
    digitar('fantasia', 'JBS');
    digitar('cnpj', '44.444.444/0001-91', false);
  }

  function preencherEndereço() {
    digitar('cep', '01310-100', false);
    digitar('logradouro', 'Avenida Paulista');
    digitar('numero', '1000');
    digitar('bairro', 'Bela Vista');
    digitar('cidade', 'São Paulo');
    escolher(harness.fixture, 'campo-uf', 'SP');
  }

  function preencherContato() {
    digitar('contato-nome', 'Otávio Lima');
    digitar('contato-email', 'otavio@jbs.com');
  }

  /** Percorre as três etapas obrigatórias e para na última, sem passar pelas buscas automáticas. */
  function preencherTudo() {
    preencherIdentificação();
    avançar();
    preencherEndereço();
    avançar();
    preencherContato();
    avançar();
  }

  describe('as etapas', () => {
    it('deve abrir na identificação, sem erro nenhum à vista', async () => {
      await novo();

      expect(etapaAtual()).toBe('identificacao');
      expect(erroDe('razao')).toBe('');
      expect(erroDe('cnpj')).toBe('');
    });

    it('não deve avançar com obrigatório faltando, e deve apontar cada um no próprio campo', async () => {
      await novo();

      avançar();

      expect(etapaAtual()).toBe('identificacao');
      for (const nome of ['razao', 'fantasia', 'cnpj']) {
        expect({ nome, erro: erroDe(nome) !== '' }).toEqual({ nome, erro: true });
      }
    });

    it('deve seguir a ordem identificação → endereço → contato → organização interna', async () => {
      await novo();

      preencherIdentificação();
      avançar();
      expect(etapaAtual()).toBe('endereco');

      preencherEndereço();
      avançar();
      expect(etapaAtual()).toBe('contato');

      preencherContato();
      avançar();
      expect(etapaAtual()).toBe('organizacao');
      expect(el('[data-testid="avancar"]')).toBeNull();
    });

    it('não deve deixar pular etapa no cadastro, mas deve deixar voltar', async () => {
      await novo();

      expect((el('[data-testid="passo-contato"] button') as HTMLButtonElement).disabled).toBe(true);

      preencherIdentificação();
      avançar();
      clicar('passo-identificacao');
      expect(etapaAtual()).toBe('identificacao');
      expect(campo('fantasia').value).toBe('JBS');
    });

    it('só deve oferecer cadastrar na última etapa', async () => {
      await novo();
      expect(el('[data-testid="salvar"]')).toBeNull();

      preencherTudo();
      expect(el('[data-testid="salvar"]')).not.toBeNull();
    });

    it('deve dizer ao lado do campo que o CNPJ não confere', async () => {
      await novo();

      digitar('cnpj', '44.444.444/0001-92');

      expect(erroDe('cnpj')).toContain('CNPJ');
    });

    it('deve aparar o e-mail antes de julgá-lo', async () => {
      await novo();
      preencherIdentificação();
      avançar();
      preencherEndereço();
      avançar();

      digitar('contato-email', '  otavio@jbs.com ');

      expect(erroDe('contato-email')).toBe('');
      expect(campo('contato-email').value).toBe('otavio@jbs.com');
    });
  });

  describe('Enter não salva', () => {
    it('não deve salvar nem avançar com Enter num campo — um esbarrão não é uma decisão', async () => {
      await novo();
      preencherTudo();

      const codigo = campo('codigo');
      const enter = new KeyboardEvent('keydown', { key: 'Enter', bubbles: true, cancelable: true });
      codigo.dispatchEvent(enter);
      codigo.closest('form')!.dispatchEvent(new Event('submit', { bubbles: true, cancelable: true }));
      harness.detectChanges();

      expect(enter.defaultPrevented).toBe(true);
      http.expectNone(`${API}/companies`);
      expect(el('[data-testid="sucesso"]')).toBeNull();
    });
  });

  describe('busca pelo CNPJ', () => {
    it('deve preencher os campos vazios, e só os vazios', async () => {
      await novo();
      digitar('fantasia', 'Friboi');

      digitar('cnpj', '44.444.444/0001-91');
      http.expectOne(CNPJ_API).flush({
        razao_social: 'JBS S.A.',
        nome_fantasia: 'JBS',
        cep: '01310100',
        logradouro: 'AVENIDA PAULISTA',
        numero: '1000',
        bairro: 'BELA VISTA',
        municipio: 'SAO PAULO',
        uf: 'SP',
      });
      harness.detectChanges();

      expect(campo('razao').value).toBe('JBS S.A.');
      expect(campo('fantasia').value).toBe('Friboi');

      avançar();
      expect(campo('logradouro').value).toBe('AVENIDA PAULISTA');
      expect(campo('cep').value).toBe('01310-100');
      expect(campo('cidade').value).toBe('SAO PAULO');
    });

    it('deve avisar e deixar digitar quando a consulta falha', async () => {
      await novo();

      digitar('cnpj', '44.444.444/0001-91');
      http.expectOne(CNPJ_API).flush('', { status: 503, statusText: 'Fora' });
      harness.detectChanges();

      expect(el('[data-testid="aviso-busca"]')?.textContent).toContain('manualmente');
      expect(campo('razao').disabled).toBe(false);
    });
  });

  describe('busca pelo CEP', () => {
    async function noEndereço() {
      await novo();
      preencherIdentificação();
      avançar();
    }

    it('deve mostrar que está buscando enquanto a consulta não volta', async () => {
      await noEndereço();

      digitar('cep', '01310-100');

      expect(el('[data-testid="buscando-cep"]')).not.toBeNull();
      http.expectOne(CEP_API('01310100')).flush({ street: 'Avenida Paulista', neighborhood: 'Bela Vista', city: 'São Paulo', state: 'SP' });
      harness.detectChanges();
      expect(el('[data-testid="buscando-cep"]')).toBeNull();
    });

    it('deve trocar logradouro, bairro, cidade e UF quando o CEP muda — o endereço é do CEP', async () => {
      await noEndereço();
      digitar('cep', '01310-100');
      http.expectOne(CEP_API('01310100')).flush({ street: 'Avenida Paulista', neighborhood: 'Bela Vista', city: 'São Paulo', state: 'SP' });
      harness.detectChanges();
      digitar('numero', '1000');
      digitar('complemento', 'Andar 5');

      digitar('cep', '89700-000');
      http.expectOne(CEP_API('89700000')).flush({ street: 'Rua Senador Atílio Fontana', neighborhood: 'Centro', city: 'Concórdia', state: 'SC' });
      harness.detectChanges();

      expect(campo('logradouro').value).toBe('Rua Senador Atílio Fontana');
      expect(campo('bairro').value).toBe('Centro');
      expect(campo('cidade').value).toBe('Concórdia');
      expect(el('[data-testid="campo-uf"]')!.textContent).toContain('SC');
      // O que o CEP não sabe fica com quem digitou.
      expect(campo('numero').value).toBe('1000');
      expect(campo('complemento').value).toBe('Andar 5');
    });

    it('deve esvaziar o que o CEP novo não informa, em vez de manter a rua do CEP antigo', async () => {
      // CEP de cidade pequena é um só para a cidade inteira: não traz rua nem bairro.
      await noEndereço();
      digitar('cep', '01310-100');
      http.expectOne(CEP_API('01310100')).flush({ street: 'Avenida Paulista', neighborhood: 'Bela Vista', city: 'São Paulo', state: 'SP' });
      harness.detectChanges();

      digitar('cep', '89770-000');
      http.expectOne(CEP_API('89770000')).flush({ city: 'Seara', state: 'SC' });
      harness.detectChanges();

      expect(campo('logradouro').value).toBe('');
      expect(campo('bairro').value).toBe('');
      expect(campo('cidade').value).toBe('Seara');
    });

    it('não deve consultar de novo quando se sai do campo sem mudar o CEP', async () => {
      await noEndereço();
      digitar('cep', '01310-100');
      http.expectOne(CEP_API('01310100')).flush({ street: 'Avenida Paulista', neighborhood: 'Bela Vista', city: 'São Paulo', state: 'SP' });
      harness.detectChanges();
      digitar('logradouro', 'Av. Paulista');

      campo('cep').dispatchEvent(new Event('blur'));
      harness.detectChanges();

      http.expectNone(() => true);
      expect(campo('logradouro').value).toBe('Av. Paulista');
    });
  });

  describe('grupo empresarial', () => {
    const opcoes = () => [...document.body.querySelectorAll('[role="option"]')].map((o) => o.textContent?.trim());

    async function abrirOrganizacao() {
      await editarBrf();
      clicar('passo-organizacao');
    }

    it('deve mostrar os grupos da carteira assim que a pessoa entra no campo', async () => {
      await abrirOrganizacao();
      campo('grupo').value = '';
      campo('grupo').dispatchEvent(new Event('focus'));
      harness.detectChanges();
      await harness.fixture.whenStable();

      expect(opcoes()).toEqual(['Grupo BRF', 'Grupo Aurora']);
    });

    it('deve filtrar pelo que foi digitado, sem ligar para acento e caixa', async () => {
      gruposDaConta = ['Grupo BRF', 'Cooperativa Aurora', 'Grupo São Martinho'];
      await abrirOrganizacao();

      digitar('grupo', 'sao', false);
      await esperar();
      harness.detectChanges();
      await harness.fixture.whenStable();

      expect(opcoes()).toEqual(['Grupo São Martinho']);
    });

    it('deve avisar que um nome fora da lista cria um grupo novo', async () => {
      await abrirOrganizacao();
      expect(el('#ajuda-grupo')?.textContent).not.toContain('Grupo novo');

      digitar('grupo', 'Grupo Friboi');
      expect(el('#ajuda-grupo')?.textContent).toContain('Grupo novo');

      digitar('grupo', 'grupo aurora');
      expect(el('#ajuda-grupo')?.textContent).not.toContain('Grupo novo');
    });
  });

  describe('cadastrar', () => {
    it('deve enviar o cadastro, atualizar a sessão e oferecer os próximos passos', async () => {
      await novo();
      preencherTudo();
      digitar('grupo', 'Grupo Friboi', false);

      salvar();

      const req = http.expectOne(`${API}/companies`);
      expect(req.request.method).toBe('POST');
      expect(req.request.body).toMatchObject<Partial<CompanyUpsertRequest>>({
        corporateName: 'JBS S.A.',
        tradeName: 'JBS',
        document: '44444444000191',
        contact: { name: 'Otávio Lima', email: 'otavio@jbs.com' },
        address: {
          zipCode: '01310100',
          street: 'Avenida Paulista',
          number: '1000',
          district: 'Bela Vista',
          city: 'São Paulo',
          state: 'SP',
        },
        groupName: 'Grupo Friboi',
      });
      req.flush(detalheDaBrf({ id: 'c-jbs', tradeName: 'JBS', status: 'IMPLANTATION', managers: [] }));

      // A empresa nova só existe na sessão depois de recarregá-la: sem isto, a
      // guarda do Contexto 2 recusaria abrir a empresa que acabou de nascer.
      http.expectOne(`${API}/auth/refresh`).flush(respostaDeLogin());
      await harness.fixture.whenStable();
      harness.detectChanges();

      expect(el('[data-testid="sucesso"]')?.textContent).toContain('JBS');
      expect(el('[data-testid="abrir-empresa"]')?.getAttribute('href')).toBe('/app/empresas/c-jbs/painel');
      expect(el('[data-testid="convidar-gestor"]')?.getAttribute('href')).toBe('/app/empresas/c-jbs/equipe');
    });

    it('deve voltar à identificação e pôr no campo CNPJ a recusa por CNPJ repetido', async () => {
      await novo();
      preencherTudo();

      salvar();
      http
        .expectOne(`${API}/companies`)
        .flush(
          { statusCode: 409, message: 'Já existe uma empresa com este CNPJ nesta conta.', field: 'document' },
          { status: 409, statusText: 'Conflict' },
        );
      harness.detectChanges();

      expect(etapaAtual()).toBe('identificacao');
      expect(erroDe('cnpj')).toContain('Já existe uma empresa com este CNPJ');
    });

    it('deve recusar logo SVG ou acima de 2 MB antes de enviar', async () => {
      await novo();
      const entrada = el('[data-testid="logo-arquivo"]') as HTMLInputElement;

      const svg = new File(['<svg/>'], 'logo.svg', { type: 'image/svg+xml' });
      Object.defineProperty(entrada, 'files', { value: [svg], configurable: true });
      entrada.dispatchEvent(new Event('change'));
      harness.detectChanges();
      expect(el('[data-testid="logo-erro"]')?.textContent).toContain('PNG, JPG ou WebP');

      const grande = new File([new Uint8Array(2 * 1024 * 1024 + 1)], 'logo.png', { type: 'image/png' });
      Object.defineProperty(entrada, 'files', { value: [grande], configurable: true });
      entrada.dispatchEvent(new Event('change'));
      harness.detectChanges();
      expect(el('[data-testid="logo-erro"]')?.textContent).toContain('2 MB');
    });

    it('deve enviar o logo escolhido depois de a empresa existir', async () => {
      await novo();
      const entrada = el('[data-testid="logo-arquivo"]') as HTMLInputElement;
      const png = new File([new Uint8Array(10)], 'logo.png', { type: 'image/png' });
      Object.defineProperty(entrada, 'files', { value: [png], configurable: true });
      entrada.dispatchEvent(new Event('change'));
      harness.detectChanges();
      preencherTudo();

      salvar();
      http.expectOne(`${API}/companies`).flush(detalheDaBrf({ id: 'c-jbs' }));
      await esperar();
      const logo = http.expectOne(`${API}/companies/c-jbs/logo`);
      expect(logo.request.method).toBe('PUT');
      logo.flush({ logoUrl: 'data:image/png;base64,AA==' });
      http.expectOne(`${API}/auth/refresh`).flush(respostaDeLogin());
    });
  });

  describe('editar', () => {
    it('deve abrir com o cadastro preenchido, e deixar ir direto a qualquer etapa', async () => {
      await editarBrf();

      expect(campo('fantasia').value).toBe('BRF');
      expect(campo('cnpj').value).toBe('22.222.222/0001-91');

      clicar('passo-endereco');
      expect(campo('cep').value).toBe('89700-000');

      clicar('passo-organizacao');
      expect(campo('codigo').value).toBe('CLI-0001');
    });

    it('deve salvar de qualquer etapa e voltar para a carteira', async () => {
      await editarBrf();
      digitar('fantasia', 'BRF Concórdia');

      salvar();
      const req = http.expectOne(`${API}/companies/${BRF.id}`);
      expect(req.request.method).toBe('PATCH');
      expect(req.request.body.tradeName).toBe('BRF Concórdia');
      expect(req.request.body.groupName).toBe('Grupo BRF');
      req.flush(detalheDaBrf({ tradeName: 'BRF Concórdia' }));
      http.expectOne(`${API}/auth/refresh`).flush(respostaDeLogin());
      await harness.fixture.whenStable();

      expect(TestBed.inject(Router).url).toBe('/app/empresas');
    });

    it('deve levar à etapa do primeiro campo inválido ao tentar salvar', async () => {
      await editarBrf();
      clicar('passo-contato');
      digitar('contato-nome', '');
      clicar('passo-identificacao');

      salvar();

      expect(etapaAtual()).toBe('contato');
      expect(erroDe('contato-nome')).not.toBe('');
      http.expectNone(`${API}/companies/${BRF.id}`);
    });

    it('deve oferecer usar os dados do Gestor no contato', async () => {
      await editarBrf(detalheDaBrf({ contact: { name: 'Outra Pessoa', email: 'outra@brf.com' } }));
      clicar('passo-contato');

      clicar('usar-gestor');

      expect(campo('contato-nome').value).toBe('Marcos');
      expect(campo('contato-email').value).toBe('marcos@email.com');
      expect(campo('contato-cargo').value).toBe('Coordenador de SST');
    });

    it('não deve oferecer usar os dados do Gestor quando não há Gestor', async () => {
      await editarBrf(detalheDaBrf({ managers: [] }));
      clicar('passo-contato');

      expect(el('[data-testid="usar-gestor"]')).toBeNull();
    });
  });
});
