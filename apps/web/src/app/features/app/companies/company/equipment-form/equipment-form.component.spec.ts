import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { Component } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { Router, provideRouter } from '@angular/router';
import { RouterTestingHarness } from '@angular/router/testing';
import { firstValueFrom } from 'rxjs';
import { vi } from 'vitest';

import type { MachineTypeOption, MembershipWithCompany, SectorListItem } from '@normatiza/shared';

import { API_BASE_URL } from '../../../../../core/auth/api.config';
import { AuthService } from '../../../../../core/auth/auth.service';
import { BRF, respostaDeLogin, sessão, vínculo } from '../../../../../core/auth/testing/sessao';
import { detalheDeEquipamento } from '../../../../../core/services/testing/equipamentos';
import { EquipmentFormComponent } from './equipment-form.component';

@Component({ template: '' })
class Destino {}

const SETORES: SectorListItem[] = [
  { id: 'sec-usinagem', name: 'Usinagem', equipmentsCount: 2, actions: { edit: true, merge: true, delete: false } },
];
const TIPOS: MachineTypeOption[] = [
  { id: 'mt-prensa-hidraulica', name: 'Prensa hidráulica', global: true },
  { id: 'mt-esteira', name: 'Esteira transportadora', global: true },
];

/**
 * O cadastro do equipamento ([03 §4.2](../../../../../../../../docs/produto/03_navegacao_e_telas.md)).
 *
 * O que se protege: só o nome é obrigatório; setor e tipo digitados que já
 * existem são reaproveitados, e os novos se criam ao salvar — o setor por quem
 * cadastra, o tipo só pela consultoria; a TAG repetida é dita no campo dela, e
 * a série repetida é avisada sem impedir.
 */
describe('EquipmentFormComponent', () => {
  let http: HttpTestingController;
  let harness: RouterTestingHarness;

  const API = 'http://api.teste';
  const EQUIPAMENTOS = `${API}/companies/${BRF.id}/equipments`;
  const SETORES_URL = `${API}/companies/${BRF.id}/sectors`;

  beforeEach(() => {
    TestBed.configureTestingModule({
      providers: [
        provideRouter([
          { path: 'app/empresas/:companySlug/equipamentos', component: Destino },
          { path: 'app/empresas/:companySlug/equipamentos/novo', component: EquipmentFormComponent },
          { path: 'app/empresas/:companySlug/equipamentos/:equipmentCode/editar', component: EquipmentFormComponent },
          { path: 'app/empresas/:companySlug/equipamentos/:equipmentCode/painel', component: Destino },
          { path: 'app/empresas/:companySlug/equipamentos/:equipmentCode/analise/:numero', component: Destino },
        ]),
        provideHttpClient(),
        provideHttpClientTesting(),
        { provide: API_BASE_URL, useValue: API },
      ],
    });
    http = TestBed.inject(HttpTestingController);
  });

  afterEach(() => http.verify());

  async function entrarComo(memberships: MembershipWithCompany[]) {
    const login = firstValueFrom(TestBed.inject(AuthService).login({ email: 'q@s.com', password: 'c' }));
    http.expectOne(`${API}/auth/login`).flush(respostaDeLogin({ session: sessão(memberships) }));
    await login;
  }

  const comoFernando = () => entrarComo([vínculo(BRF.id, ['TECHNICIAN'])]);
  const comoMarcos = () => entrarComo([vínculo(BRF.id, ['MANAGER'])]);

  /** Abre o formulário e responde as listas de apoio: setores e tipos. */
  async function abrir(url = `/app/empresas/${BRF.slug}/equipamentos/novo`) {
    harness = await RouterTestingHarness.create();
    await harness.navigateByUrl(url, EquipmentFormComponent);
    http.expectOne(SETORES_URL).flush(SETORES);
    http.expectOne(`${API}/machine-types`).flush(TIPOS);
    harness.detectChanges();
  }

  const raiz = () => harness.routeNativeElement as HTMLElement;
  const el = (seletor: string) => raiz().querySelector<HTMLElement>(seletor);
  const campo = (nome: string) => {
    const alvo = el(`[data-testid="campo-${nome}"]`);
    return (alvo?.matches('input, textarea') ? alvo : alvo?.querySelector('input')) as HTMLInputElement;
  };
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
  const salvar = () => clicar('salvar');
  const avançar = () => clicar('avancar');
  /** Da identificação até a foto, a etapa em que o cadastro novo salva. */
  const atéOFim = () => {
    while (el('[data-testid="avancar"]')) avançar();
  };
  const etapaAtual = () => el('[data-testid="etapa-atual"]')?.getAttribute('data-etapa');
  const url = () => TestBed.inject(Router).url;
  const assentar = async () => {
    await harness.fixture.whenStable();
    harness.detectChanges();
  };

  describe('cadastrar', () => {
    it('deve cadastrar só com o nome, e voltar ao inventário confirmando pelo código', async () => {
      await comoFernando();
      await abrir();

      digitar('nome', 'Prensa excêntrica 60t');
      atéOFim();
      salvar();

      const req = http.expectOne(EQUIPAMENTOS);
      expect(req.request.method).toBe('POST');
      expect(req.request.body).toMatchObject({ name: 'Prensa excêntrica 60t', sectorId: null, machineTypeId: null });
      req.flush(detalheDeEquipamento());
      await assentar();

      expect(url()).toBe(`/app/empresas/${BRF.slug}/equipamentos?cadastrado=eq-0001`);
    });

    it('não deve passar da identificação sem nome, e dizer isso no campo', async () => {
      await comoFernando();
      await abrir();

      avançar();

      expect(etapaAtual()).toBe('identificacao');
      expect(el('[data-testid="erro-nome"]')?.textContent).toContain('nome');
      http.expectNone(EQUIPAMENTOS);
    });

    it('deve oferecer o cadastro só na última etapa, e voltar sem perder o que foi digitado', async () => {
      await comoFernando();
      await abrir();

      expect(el('[data-testid="salvar"]')).toBeNull();
      digitar('nome', 'Prensa');
      const vistas: (string | null | undefined)[] = [etapaAtual()];
      atéOFim();
      clicar('passo-identificacao');
      for (const _ of [1, 2, 3, 4]) {
        avançar();
        vistas.push(etapaAtual());
      }

      expect(vistas).toEqual(['identificacao', 'planta', 'operacao', 'porte', 'foto']);
      expect(el('[data-testid="salvar"]')).not.toBeNull();
      clicar('passo-identificacao');
      expect(campo('nome').value).toBe('Prensa');
    });

    it('não deve salvar com Enter no meio do caminho', async () => {
      await comoFernando();
      await abrir();
      digitar('nome', 'Prensa');

      campo('nome').dispatchEvent(new KeyboardEvent('keydown', { key: 'Enter', bubbles: true }));
      harness.detectChanges();

      http.expectNone(EQUIPAMENTOS);
    });

    it('deve reaproveitar o setor que já existe, mesmo digitado sem acento e em outra caixa', async () => {
      await comoFernando();
      await abrir();

      digitar('nome', 'Torno');
      avançar();
      digitar('setor', ' USINAGEM ');
      expect(el('[data-testid="ajuda-setor"]')?.textContent).not.toContain('novo');
      atéOFim();
      salvar();

      http.expectNone((r) => r.method === 'POST' && r.url === SETORES_URL);
      const req = http.expectOne(EQUIPAMENTOS);
      expect(req.request.body.sectorId).toBe('sec-usinagem');
      req.flush(detalheDeEquipamento());
    });

    it('deve criar ao salvar o setor que ainda não existe, avisando antes', async () => {
      await comoFernando();
      await abrir();

      digitar('nome', 'Torno');
      avançar();
      digitar('setor', 'Caldeiraria');
      expect(el('[data-testid="ajuda-setor"]')?.textContent).toContain('Setor novo');
      atéOFim();
      salvar();

      const novo = http.expectOne((r) => r.method === 'POST' && r.url === SETORES_URL);
      expect(novo.request.body).toEqual({ name: 'Caldeiraria' });
      novo.flush({ ...SETORES[0], id: 'sec-cal', name: 'Caldeiraria', existing: false });
      const req = http.expectOne(EQUIPAMENTOS);
      expect(req.request.body.sectorId).toBe('sec-cal');
      req.flush(detalheDeEquipamento());
    });

    it('deve deixar a consultoria acrescentar um tipo de máquina ao catálogo ao salvar', async () => {
      await comoFernando();
      await abrir();

      digitar('nome', 'Tombador 2');
      digitar('tipo', 'Tombador de caixas');
      atéOFim();
      salvar();

      const tipo = http.expectOne((r) => r.method === 'POST' && r.url === `${API}/machine-types`);
      expect(tipo.request.body).toEqual({ name: 'Tombador de caixas' });
      tipo.flush({ id: 'mt-tombador', name: 'Tombador de caixas', global: false });
      expect(http.expectOne(EQUIPAMENTOS).request.body.machineTypeId).toBe('mt-tombador');
    });

    it('não deve deixar o cliente criar tipo: o que está fora do catálogo fica para a consultoria', async () => {
      await comoMarcos();
      await abrir();

      digitar('nome', 'Tombador 2');
      digitar('tipo', 'Tombador de caixas');
      expect(el('[data-testid="ajuda-tipo"]')?.textContent).toContain('consultoria');
      atéOFim();
      salvar();

      http.expectNone((r) => r.method === 'POST' && r.url === `${API}/machine-types`);
      expect(http.expectOne(EQUIPAMENTOS).request.body.machineTypeId).toBeNull();
    });

    it('deve voltar à etapa da TAG e mostrar no campo a recusa por TAG repetida', async () => {
      await comoFernando();
      await abrir();

      digitar('nome', 'Prensa 2');
      avançar();
      digitar('tag', 'PR-01');
      atéOFim();
      salvar();
      http.expectOne(EQUIPAMENTOS).flush(
        { statusCode: 409, field: 'tag', message: 'A TAG PR-01 já é de "Prensa 1" (EQ-0001), nesta empresa.' },
        { status: 409, statusText: 'Conflict' },
      );
      harness.detectChanges();

      expect(etapaAtual()).toBe('planta');
      expect(el('[data-testid="erro-tag"]')?.textContent).toContain('Prensa 1');
    });

    it('deve avisar, sem impedir, que o número de série já é de outra máquina', async () => {
      await comoFernando();
      await abrir();

      digitar('serie', '871639');
      const busca = http.expectOne((r) => r.url === `${EQUIPAMENTOS}/duplicates`);
      expect(busca.request.params.get('serialNumber')).toBe('871639');
      busca.flush({ serialNumber: [{ code: 'EQ-0007', name: 'Esteira 1' }], patrimonyCode: [] });
      harness.detectChanges();

      expect(el('[data-testid="aviso-serie"]')?.textContent).toContain('EQ-0007');
      digitar('nome', 'Esteira 2');
      atéOFim();
      salvar();
      http.expectOne(EQUIPAMENTOS).flush(detalheDeEquipamento());
    });

    it('deve enviar a ficha do ativo junto: operação, energia, dimensões e fabricante', async () => {
      await comoFernando();
      await abrir();

      digitar('nome', 'Esteira de ração');
      avançar();
      avançar();
      digitar('utilizacao', 'Transporte de ração');
      digitar('capacidade', '10 t/h');
      digitar('potencia', '0,55');
      digitar('operadores', '3');
      (el('[data-testid="energia-ELECTRIC"] input') as HTMLInputElement).click();
      (el('[data-testid="energia-PNEUMATIC"] input') as HTMLInputElement).click();
      harness.detectChanges();
      avançar();
      digitar('altura', '1200');
      digitar('peso', '450,5');
      digitar('fabricante-cnpj', '11.222.333/0001-81');
      atéOFim();
      salvar();

      const req = http.expectOne(EQUIPAMENTOS);
      expect(req.request.body.sheet).toEqual({
        purpose: 'Transporte de ração',
        productiveCapacity: '10 t/h',
        powerKw: 0.55,
        exposedOperators: 3,
        energySources: ['ELECTRIC', 'PNEUMATIC'],
        dimensions: { heightMm: 1200, weightKg: 450.5 },
        manufacturer: { document: '11222333000181' },
      });
      req.flush(detalheDeEquipamento());
    });

    it('não deve deixar digitar letra onde a medida é número, e mostrar a unidade no campo', async () => {
      await comoFernando();
      await abrir();

      digitar('nome', 'Esteira');
      avançar();
      avançar();
      digitar('operadores', '3 pessoas');

      expect(campo('operadores').value).toBe('3');
      expect(el('[data-testid="campo-operadores"]')?.closest('p-inputgroup')?.textContent).toContain('pessoas');
    });

    it('deve recusar na identificação o ano fora do possível', async () => {
      await comoFernando();
      await abrir();

      digitar('nome', 'Prensa');
      digitar('ano', '1850');
      avançar();

      expect(etapaAtual()).toBe('identificacao');
      expect(el('[data-testid="erro-ano"]')?.textContent).toContain('1900');
    });

    it('deve enviar a foto depois de criar o equipamento', async () => {
      await comoFernando();
      await abrir();

      digitar('nome', 'Prensa');
      atéOFim();
      const entrada = el('[data-testid="foto-arquivo"]') as HTMLInputElement;
      const arquivo = new File([new Uint8Array([0xff, 0xd8, 0xff, 0xe0])], 'prensa.jpg', { type: 'image/jpeg' });
      Object.defineProperty(entrada, 'files', { value: [arquivo] });
      entrada.dispatchEvent(new Event('change'));
      harness.detectChanges();
      salvar();

      http.expectOne(EQUIPAMENTOS).flush(detalheDeEquipamento());
      const foto = http.expectOne(`${EQUIPAMENTOS}/EQ-0001/photo`);
      expect(foto.request.method).toBe('PUT');
      foto.flush({ photoUrl: 'x', thumbnailUrl: 'y' });
    });

    it('deve desistir de esperar em 20 segundos, sem perder o que foi preenchido', async () => {
      await comoFernando();
      await abrir();
      digitar('nome', 'Prensa');
      atéOFim();
      vi.useFakeTimers();
      try {
        salvar();
        const perdido = http.expectOne(EQUIPAMENTOS);

        vi.advanceTimersByTime(20_000);
        harness.detectChanges();

        expect(perdido.cancelled).toBe(true);
        expect(el('[data-testid="erro"]')?.textContent).toContain('não respondeu');
        clicar('passo-identificacao');
        expect(campo('nome').value).toBe('Prensa');
      } finally {
        vi.useRealTimers();
      }
    });
  });

  describe('editar', () => {
    it('deve abrir preenchido, com qualquer etapa a um clique, e voltar ao painel ao salvar', async () => {
      await comoFernando();
      harness = await RouterTestingHarness.create();
      await harness.navigateByUrl(`/app/empresas/${BRF.slug}/equipamentos/eq-0001/editar`, EquipmentFormComponent);
      http.expectOne(SETORES_URL).flush(SETORES);
      http.expectOne(`${API}/machine-types`).flush(TIPOS);
      http.expectOne(`${EQUIPAMENTOS}/eq-0001`).flush(detalheDeEquipamento({ sector: { id: 'sec-usinagem', name: 'Usinagem' } }));
      await assentar();

      expect(campo('nome').value).toBe('Prensa excêntrica 60t');
      expect(campo('serie').value).toBe('SN-1234');
      clicar('passo-planta');
      expect(campo('setor').value).toBe('Usinagem');
      clicar('passo-operacao');
      await assentar();
      expect(campo('utilizacao').value).toBe('Estampagem de chapas');
      expect(campo('potencia').value).toBe('7,5');
      expect((el('[data-testid="energia-PNEUMATIC"] input') as HTMLInputElement).checked).toBe(true);
      clicar('passo-porte');
      expect(campo('altura').value).toBe('2.400');
      expect(campo('fabricante-cnpj').value).toBe('11.222.333/0001-81');

      // Na edição o cadastro já está completo: salvar vale de qualquer etapa.
      clicar('passo-identificacao');
      digitar('nome', 'Prensa 60t');
      salvar();
      const req = http.expectOne(`${EQUIPAMENTOS}/EQ-0001`);
      expect(req.request.method).toBe('PATCH');
      expect(req.request.body).toMatchObject({
        name: 'Prensa 60t',
        sectorId: 'sec-usinagem',
        manufactureYear: 2012,
        sheet: { purpose: 'Estampagem de chapas', powerKw: 7.5, energySources: ['ELECTRIC', 'PNEUMATIC'] },
      });
      req.flush(detalheDeEquipamento({ name: 'Prensa 60t' }));
      await assentar();

      expect(url()).toBe(`/app/empresas/${BRF.slug}/equipamentos/eq-0001/painel`);
    });

    /** Edita pela URL dada, troca o nome e salva: devolve para onde o formulário foi. */
    async function editarESalvar(endereço: string) {
      await comoFernando();
      harness = await RouterTestingHarness.create();
      await harness.navigateByUrl(endereço, EquipmentFormComponent);
      http.expectOne(SETORES_URL).flush(SETORES);
      http.expectOne(`${API}/machine-types`).flush(TIPOS);
      http.expectOne(`${EQUIPAMENTOS}/eq-0001`).flush(detalheDeEquipamento({ sector: { id: 'sec-usinagem', name: 'Usinagem' } }));
      await assentar();
      digitar('nome', 'Prensa 60t');
      salvar();
      http.expectOne(`${EQUIPAMENTOS}/EQ-0001`).flush(detalheDeEquipamento({ name: 'Prensa 60t' }));
      await assentar();
      return url();
    }

    it('deve voltar para a análise que pediu a correção da ficha, ao salvar', async () => {
      const analise = `/app/empresas/${BRF.slug}/equipamentos/eq-0001/analise/1`;

      const destino = await editarESalvar(
        `/app/empresas/${BRF.slug}/equipamentos/eq-0001/editar?voltar=${encodeURIComponent(analise)}`,
      );

      expect(destino).toBe(analise);
    });

    it('não deve mandar para fora da aplicação, qualquer que seja o endereço de volta pedido', async () => {
      const destino = await editarESalvar(
        `/app/empresas/${BRF.slug}/equipamentos/eq-0001/editar?voltar=${encodeURIComponent('https://golpe.example/app/x')}`,
      );

      expect(destino).toBe(`/app/empresas/${BRF.slug}/equipamentos/eq-0001/painel`);
    });
  });
});
