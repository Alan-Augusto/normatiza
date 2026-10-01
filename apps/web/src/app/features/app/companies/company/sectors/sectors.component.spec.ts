import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { Component } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { provideRouter } from '@angular/router';
import { RouterTestingHarness } from '@angular/router/testing';
import { firstValueFrom } from 'rxjs';

import type { MembershipWithCompany, SectorListItem } from '@normatiza/shared';

import { API_BASE_URL } from '../../../../../core/auth/api.config';
import { AuthService } from '../../../../../core/auth/auth.service';
import { BRF, respostaDeLogin, sessão, vínculo } from '../../../../../core/auth/testing/sessao';
import { SectorsComponent } from './sectors.component';
import { hostDeModais } from '../../../../../core/modal/testing/host-de-modais';

@Component({ template: '' })
class Destino {}

const EDITA = { edit: true, merge: true, delete: true };

function setor(over: Partial<SectorListItem> = {}): SectorListItem {
  return { id: 'sec-usinagem', name: 'Usinagem', equipmentsCount: 3, actions: { ...EDITA, delete: false }, ...over };
}

/**
 * Os setores da planta ([03 §4.3](../../../../../../../../docs/produto/03_navegacao_e_telas.md)).
 *
 * O que se protege: digitar um setor que já existe não cria um segundo — a
 * tela diz qual já estava lá —, e o setor errado se corrige mesclando, sem
 * perder as máquinas.
 */
describe('SectorsComponent', () => {
  let http: HttpTestingController;
  let modais: ReturnType<typeof hostDeModais>;
  let harness: RouterTestingHarness;

  const API = 'http://api.teste';
  const SETORES = `${API}/companies/${BRF.id}/sectors`;

  beforeEach(() => {
    TestBed.configureTestingModule({
      providers: [
        provideRouter([
          { path: 'app/empresas/:companySlug/setores', component: SectorsComponent },
          { path: 'app/empresas/:companySlug/equipamentos', component: Destino },
        ]),
        provideHttpClient(),
        provideHttpClientTesting(),
        { provide: API_BASE_URL, useValue: API },
      ],
    });
    http = TestBed.inject(HttpTestingController);
    modais = hostDeModais();
  });

  afterEach(() => http.verify());

  async function entrarComo(memberships: MembershipWithCompany[]) {
    const login = firstValueFrom(TestBed.inject(AuthService).login({ email: 'q@s.com', password: 'c' }));
    http.expectOne(`${API}/auth/login`).flush(respostaDeLogin({ session: sessão(memberships) }));
    await login;
  }

  async function abrir(setores: SectorListItem[]) {
    harness = await RouterTestingHarness.create();
    await harness.navigateByUrl(`/app/empresas/${BRF.slug}/setores`, SectorsComponent);
    http.expectOne(SETORES).flush(setores);
    harness.detectChanges();
  }

  const raiz = () => harness.routeNativeElement as HTMLElement;
  const el = (seletor: string) => raiz().querySelector<HTMLElement>(seletor);
  const noDialogo = (seletor: string) => document.querySelector<HTMLElement>(seletor);
  /** A tela e o modal (que sai pelo host, e o `p-dialog` desenha depois). */
  const atualizar = async () => {
    harness.detectChanges();
    modais.detectChanges();
    await modais.whenStable();
    modais.detectChanges();
  };
  const clicar = async (alvo: HTMLElement | null) => {
    ((alvo?.querySelector('button') as HTMLElement | null) ?? alvo)!.click();
    await atualizar();
  };
  function digitar(entrada: HTMLInputElement, valor: string) {
    entrada.value = valor;
    entrada.dispatchEvent(new Event('input'));
    harness.detectChanges();
  }

  it('deve listar os setores com a contagem de equipamentos, que leva ao inventário filtrado', async () => {
    await entrarComo([vínculo(BRF.id, ['MANAGER'])]);
    await abrir([setor()]);

    const link = el('[data-testid="equipamentos-do-setor"]') as HTMLAnchorElement;
    expect(link.textContent?.trim()).toBe('3');
    expect(link.getAttribute('href')).toBe(`/app/empresas/${BRF.slug}/equipamentos?setor=sec-usinagem`);
  });

  it('deve criar o setor digitado e mostrá-lo na lista', async () => {
    await entrarComo([vínculo(BRF.id, ['MANAGER'])]);
    await abrir([]);

    digitar(el('[data-testid="novo-setor"]') as HTMLInputElement, 'Caldeiraria');
    await clicar(el('[data-testid="adicionar-setor"]'));

    const req = http.expectOne(SETORES);
    expect(req.request.method).toBe('POST');
    expect(req.request.body).toEqual({ name: 'Caldeiraria' });
    req.flush({ ...setor({ id: 'sec-cal', name: 'Caldeiraria', equipmentsCount: 0 }), existing: false });
    http.expectOne(SETORES).flush([setor({ id: 'sec-cal', name: 'Caldeiraria', equipmentsCount: 0 })]);
    harness.detectChanges();

    expect(raiz().textContent).toContain('Caldeiraria');
  });

  it('deve dizer qual setor já existia, em vez de criar outro igual', async () => {
    await entrarComo([vínculo(BRF.id, ['MANAGER'])]);
    await abrir([setor()]);

    digitar(el('[data-testid="novo-setor"]') as HTMLInputElement, 'usinágem');
    await clicar(el('[data-testid="adicionar-setor"]'));
    http.expectOne(SETORES).flush({ ...setor(), existing: true });
    http.expectOne(SETORES).flush([setor()]);
    harness.detectChanges();

    expect(el('[data-testid="aviso"]')?.textContent).toContain('já existia');
    expect(el('[data-testid="aviso"]')?.textContent).toContain('Usinagem');
  });

  it('não deve oferecer criar nem mexer a quem só acompanha', async () => {
    await entrarComo([vínculo(BRF.id, ['DIRECTOR'])]);
    await abrir([setor({ actions: { edit: false, merge: false, delete: false } })]);

    expect(el('[data-testid="novo-setor"]')).toBeNull();
    expect(el('[data-testid="acao-editar"]')).toBeNull();
    expect(el('[data-testid="acao-mesclar"]')).toBeNull();
  });

  it('deve renomear, e mostrar no campo a recusa por nome de outro setor', async () => {
    await entrarComo([vínculo(BRF.id, ['MANAGER'])]);
    await abrir([setor(), setor({ id: 'sec-cal', name: 'Caldeiraria', equipmentsCount: 0 })]);

    await clicar(el('[data-testid="acao-editar"]'));
    http.expectOne(`${API}/companies/${BRF.id}/members`).flush({ accountName: 'Normatiza', technicalResponsibles: [], members: [] });
    await atualizar();
    digitar(noDialogo('[data-testid="campo-nome"]') as HTMLInputElement, 'caldeiraria');
    await clicar(noDialogo('[data-testid="salvar-setor"]'));

    http.expectOne(`${SETORES}/sec-usinagem`).flush(
      { statusCode: 409, field: 'name', message: 'Já existe o setor "Caldeiraria". Para juntar os dois, use Mesclar.' },
      { status: 409, statusText: 'Conflict' },
    );
    await atualizar();

    expect(noDialogo('[data-testid="erro-nome"]')?.textContent).toContain('use Mesclar');
  });

  it('deve mesclar no setor escolhido, levando os equipamentos junto', async () => {
    await entrarComo([vínculo(BRF.id, ['MANAGER'])]);
    await abrir([setor({ id: 'sec-errado', name: 'Usinagen' }), setor()]);

    await clicar(el('[data-sector="sec-errado"] [data-testid="acao-mesclar"]'));
    expect(document.body.textContent).toContain('3 equipamentos');
    await clicar(noDialogo('[data-testid="destino-da-mescla"] [data-opcao="Usinagem"] input'));
    await clicar(noDialogo('[data-testid="confirmar-mescla"]'));

    const req = http.expectOne(`${SETORES}/sec-errado/merge`);
    expect(req.request.body).toEqual({ intoSectorId: 'sec-usinagem' });
    req.flush(null);
    await atualizar();
    http.expectOne(SETORES).flush([setor({ equipmentsCount: 6 })]);
  });

  it('deve excluir só o setor vazio, depois de confirmar', async () => {
    await entrarComo([vínculo(BRF.id, ['MANAGER'])]);
    await abrir([setor(), setor({ id: 'sec-vazio', name: 'Vazio', equipmentsCount: 0, actions: EDITA })]);

    expect(el('[data-sector="sec-usinagem"] [data-testid="acao-excluir"]')).toBeNull();
    await clicar(el('[data-sector="sec-vazio"] [data-testid="acao-excluir"]'));
    await clicar(noDialogo('[data-testid="confirmar-excluir"]'));

    const req = http.expectOne(`${SETORES}/sec-vazio`);
    expect(req.request.method).toBe('DELETE');
    req.flush(null);
    http.expectOne(SETORES).flush([setor()]);
  });
});
