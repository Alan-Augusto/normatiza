import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { Component } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { Router, provideRouter } from '@angular/router';
import { RouterTestingHarness } from '@angular/router/testing';
import { firstValueFrom } from 'rxjs';

import type { EquipmentListItem, MembershipWithCompany, SectorListItem } from '@normatiza/shared';

import { API_BASE_URL } from '../../../../../core/auth/api.config';
import { AuthService } from '../../../../../core/auth/auth.service';
import { BRF, respostaDeLogin, sessão, vínculo } from '../../../../../core/auth/testing/sessao';
import { SÓ_LÊ, linhaDeEquipamento } from '../../../../../core/services/testing/equipamentos';
import { EquipmentsComponent } from './equipments.component';

@Component({ template: '' })
class Destino {}

const SETORES: SectorListItem[] = [
  { id: 'sec-estamparia', name: 'Estamparia', equipmentsCount: 1, actions: { edit: true, merge: true, delete: false } },
];

/**
 * O inventário da planta ([03 §4.2](../../../../../../../../docs/produto/03_navegacao_e_telas.md)).
 *
 * O que estes testes protegem: a tela não inventa medida de análise que não
 * existe, não oferece o que a alçada de quem olha não alcança, e guarda na URL
 * a lista como a pessoa a deixou.
 */
describe('EquipmentsComponent', () => {
  let http: HttpTestingController;
  let harness: RouterTestingHarness;

  const API = 'http://api.teste';
  const LISTA = `${API}/companies/${BRF.id}/equipments`;

  beforeEach(() => {
    TestBed.configureTestingModule({
      providers: [
        provideRouter([
          { path: 'app/empresas/:companySlug/equipamentos', component: EquipmentsComponent },
          { path: 'app/empresas/:companySlug/equipamentos/novo', component: Destino },
          { path: 'app/empresas/:companySlug/equipamentos/:equipmentCode/painel', component: Destino },
          { path: 'app/empresas/:companySlug/equipamentos/:equipmentCode/editar', component: Destino },
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
  const comoDébora = () => entrarComo([vínculo(BRF.id, ['DIRECTOR'])]);

  async function abrir(url = `/app/empresas/${BRF.slug}/equipamentos`, lista: EquipmentListItem[] = [linhaDeEquipamento()]) {
    harness = await RouterTestingHarness.create();
    await harness.navigateByUrl(url, EquipmentsComponent);
    http.expectOne(`${API}/companies/${BRF.id}/sectors`).flush(SETORES);
    responderLista(lista);
  }

  function responderLista(lista: EquipmentListItem[]) {
    http.expectOne((r) => r.url === LISTA).flush(lista);
    harness.detectChanges();
  }

  const raiz = () => harness.routeNativeElement as HTMLElement;
  const el = (seletor: string) => raiz().querySelector<HTMLElement>(seletor);
  const todos = (seletor: string) => Array.from(raiz().querySelectorAll<HTMLElement>(seletor));
  const texto = (seletor: string) => el(seletor)?.textContent?.trim() ?? '';
  const esperar = (ms: number) => new Promise((r) => setTimeout(r, ms));

  describe('a tabela', () => {
    it('deve mostrar a identidade da máquina: código, nome, tipo, TAG e setor', async () => {
      await comoFernando();
      await abrir();

      const linha = el('[data-testid="linha"]')!;
      for (const trecho of ['EQ-0001', 'Prensa excêntrica 60t', 'Prensa excêntrica', 'PR-01', 'Estamparia']) {
        expect(linha.textContent).toContain(trecho);
      }
    });

    it('deve mostrar "—" onde a medida é da análise, e zero pontos em aberto', async () => {
      // Sem análise não há pior HRN nem última análise: um número seria invenção.
      await comoFernando();
      await abrir();

      expect(texto('[data-testid="pior-hrn"]')).toBe('—');
      expect(texto('[data-testid="ultima-analise"]')).toBe('—');
      expect(texto('[data-testid="pontos-abertos"]')).toBe('0');
      expect(texto('[data-testid="conformidade"]')).toBe('Sem análise');
    });

    it('deve mostrar a miniatura da foto, e um ícone quando não há foto', async () => {
      await comoFernando();
      await abrir(undefined, [
        linhaDeEquipamento({ thumbnailUrl: 'https://arquivos.teste/eq1-thumb.webp' }),
        linhaDeEquipamento({ code: 'EQ-0002', name: 'Sem foto' }),
      ]);

      const [comFoto, semFoto] = todos('[data-testid="linha"]');
      expect(comFoto.querySelector('img')?.getAttribute('src')).toBe('https://arquivos.teste/eq1-thumb.webp');
      expect(semFoto.querySelector('img')).toBeNull();
      expect(semFoto.querySelector('[data-testid="sem-foto"]')).not.toBeNull();
    });

    it('deve dizer que a máquina está desativada', async () => {
      await comoFernando();
      await abrir(`/app/empresas/${BRF.slug}/equipamentos?status=ALL`, [
        linhaDeEquipamento({ status: 'INACTIVE', actions: { edit: false, deactivate: false, reactivate: true, delete: true } }),
      ]);

      expect(el('[data-testid="linha"]')!.textContent).toContain('Desativado');
    });

    it('deve entrar no equipamento pelo código, em minúsculas na URL', async () => {
      await comoFernando();
      await abrir();

      el('[data-testid="abrir-equipamento"]')!.click();
      await harness.fixture.whenStable();

      expect(TestBed.inject(Router).url).toBe(`/app/empresas/${BRF.slug}/equipamentos/eq-0001/painel`);
    });
  });

  describe('os cartões', () => {
    it('deve alternar para cartões com a miniatura, e guardar a escolha na URL', async () => {
      await comoFernando();
      await abrir(undefined, [linhaDeEquipamento({ thumbnailUrl: 'https://arquivos.teste/t.webp' })]);

      el('[data-testid="vista-cartoes"]')!.click();
      await harness.fixture.whenStable();
      responderLista([linhaDeEquipamento({ thumbnailUrl: 'https://arquivos.teste/t.webp' })]);

      expect(TestBed.inject(Router).url).toContain('vista=cartoes');
      const cartão = el('[data-testid="cartao"]')!;
      expect(cartão.querySelector('img')?.getAttribute('src')).toBe('https://arquivos.teste/t.webp');
      expect(cartão.textContent).toContain('EQ-0001');
      expect(el('[data-testid="linha"]')).toBeNull();
    });
  });

  describe('busca e filtros', () => {
    it('deve buscar pelo que foi digitado, guardando o termo na URL', async () => {
      await comoFernando();
      await abrir();

      const busca = el('[data-testid="busca"]') as HTMLInputElement;
      busca.value = 'prensa';
      busca.dispatchEvent(new Event('input'));
      await esperar(350);
      await harness.fixture.whenStable();

      const req = http.expectOne((r) => r.url === LISTA);
      expect(req.request.params.get('q')).toBe('prensa');
      req.flush([]);
      expect(TestBed.inject(Router).url).toContain('q=prensa');
    });

    it('deve abrir com o setor da URL já aplicado', async () => {
      await comoFernando();
      harness = await RouterTestingHarness.create();
      await harness.navigateByUrl(`/app/empresas/${BRF.slug}/equipamentos?setor=sec-estamparia`, EquipmentsComponent);
      http.expectOne(`${API}/companies/${BRF.id}/sectors`).flush(SETORES);

      const req = http.expectOne((r) => r.url === LISTA);
      expect(req.request.params.get('sectorId')).toBe('sec-estamparia');
      req.flush([]);
    });
  });

  describe('o que cada um pode fazer', () => {
    it('deve oferecer o cadastro a quem cadastra, e não à Diretora', async () => {
      await comoFernando();
      await abrir();
      expect(el('[data-testid="novo-equipamento"]')).not.toBeNull();
    });

    it('não deve oferecer cadastro nem ações de edição a quem só acompanha', async () => {
      await comoDébora();
      await abrir(undefined, [linhaDeEquipamento({ actions: SÓ_LÊ })]);

      expect(el('[data-testid="novo-equipamento"]')).toBeNull();
      expect(el('[data-testid="acao-editar"]')).toBeNull();
      expect(el('[data-testid="acao-desativar"]')).toBeNull();
    });

    it('não deve oferecer cadastro em empresa inativa', async () => {
      await entrarComo([vínculo(BRF.id, ['TECHNICIAN'], { company: { ...BRF, status: 'INACTIVE' } })]);
      await abrir();

      expect(el('[data-testid="novo-equipamento"]')).toBeNull();
    });

    it('deve desativar só depois de confirmar, e recarregar a lista', async () => {
      await comoFernando();
      await abrir();

      el('[data-testid="acao-desativar"] button')!.click();
      harness.detectChanges();
      (document.querySelector('[data-testid="confirmar-desativar"] button') as HTMLElement).click();

      http.expectOne(`${LISTA}/EQ-0001/deactivate`).flush(null);
      responderLista([]);
    });

    it('deve excluir de vez só depois de confirmar, dizendo que não tem volta', async () => {
      await comoFernando();
      await abrir();

      el('[data-testid="acao-excluir"] button')!.click();
      harness.detectChanges();
      expect(document.body.textContent).toContain('não tem volta');
      (document.querySelector('[data-testid="confirmar-excluir"] button') as HTMLElement).click();

      const req = http.expectOne(`${LISTA}/EQ-0001`);
      expect(req.request.method).toBe('DELETE');
      req.flush(null);
      responderLista([]);
    });
  });

  describe('lista vazia', () => {
    it('deve oferecer o primeiro cadastro no inventário vazio', async () => {
      await comoFernando();
      await abrir(undefined, []);

      expect(el('[data-testid="novo-equipamento-vazio"]')).not.toBeNull();
    });

    it('não deve oferecer cadastro quando é a busca que não achou nada', async () => {
      await comoFernando();
      await abrir(`/app/empresas/${BRF.slug}/equipamentos?q=xyz`, []);

      expect(el('[data-testid="novo-equipamento-vazio"]')).toBeNull();
      expect(raiz().textContent).toContain('Nenhum equipamento encontrado');
    });
  });

  it('deve confirmar o cadastro recém-feito, pelo código e pelo nome', async () => {
    await comoFernando();
    await abrir(`/app/empresas/${BRF.slug}/equipamentos?cadastrado=eq-0001`);

    expect(texto('[data-testid="aviso"]')).toContain('EQ-0001');
    expect(texto('[data-testid="aviso"]')).toContain('Prensa excêntrica 60t');
  });
});
