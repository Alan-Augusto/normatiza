import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { ComponentFixture, TestBed } from '@angular/core/testing';

import type { Role } from '@normatiza/shared';

import { API_BASE_URL } from '../../../core/auth/api.config';
import { digitar, elemento, elementos, opcoesDe } from '../../../core/testing/prime';
import { InviteFormComponent } from './invite-form.component';

/**
 * O convite, nas três formas que ele tem (D21).
 *
 * As telas de equipe afirmam a **regra** — "à Carla só se oferece Técnico" —
 * através de `opcoesDe`, que lê tanto a lista quanto o papel declarado. Um
 * ajudante que lê duas formas passaria mesmo se a tela ficasse muda; é este
 * arquivo que fecha essa porta, afirmando a **forma** de cada caso.
 */
describe('InviteFormComponent', () => {
  let fixture: ComponentFixture<InviteFormComponent>;
  let http: HttpTestingController;

  const API = 'http://api.teste';

  const TODOS_DO_JOSUÉ: Role[] = [
    'CONSULTANT_ENGINEER',
    'TECHNICIAN',
    'MANAGER',
    'CLIENT_ENGINEER',
    'DIRECTOR',
    'EXECUTOR',
  ];

  const DO_MARCOS: Role[] = ['CLIENT_ENGINEER', 'DIRECTOR', 'EXECUTOR'];

  beforeEach(() => {
    TestBed.configureTestingModule({
      imports: [InviteFormComponent],
      providers: [
        provideHttpClient(),
        provideHttpClientTesting(),
        { provide: API_BASE_URL, useValue: API },
      ],
    });
    http = TestBed.inject(HttpTestingController);
  });

  afterEach(() => http.verify());

  function montar(roles: Role[], fixedCompanyId?: string): void {
    fixture = TestBed.createComponent(InviteFormComponent);
    fixture.componentRef.setInput('roles', roles);
    if (fixedCompanyId) fixture.componentRef.setInput('fixedCompanyId', fixedCompanyId);
    fixture.detectChanges();
  }

  const el = (seletor: string) => elemento(fixture, seletor);
  const todos = (seletor: string) => elementos(fixture, seletor);

  describe('quando quem convida concede um papel só', () => {
    it('não deve haver escolha a fazer', async () => {
      // O Antonio concede Executor e nada mais. Uma lista de uma opção só é
      // uma pergunta encenada — a mesma razão que já esconde o seletor de
      // empresas dentro de uma empresa.
      montar(['EXECUTOR']);

      expect(el('[data-testid="papel-unico"]')).not.toBeNull();
      expect(todos('[data-testid="opcao-de-papel"]').length).toBe(0);
      expect(todos('[data-testid="convite-papel"] input[type="radio"]').length).toBe(0);
    });

    it('deve mesmo assim dizer o que aquele papel alcança', async () => {
      // Não escolher não é não precisar saber: quem convida um executor
      // precisa saber que a análise não vai aparecer para ele.
      montar(['EXECUTOR']);

      const texto = el('[data-testid="papel-unico"]')!.textContent ?? '';

      expect(texto).toContain('Executor');
      expect(texto).toContain('tarefas designadas');
      expect(texto).toContain('Não vê a análise');
    });

    it('deve enviar aquele papel sem ninguém ter escolhido nada', async () => {
      // O campo não existe, mas o valor precisa existir: sem isto o formulário
      // nasceria inválido por um campo que ninguém tem como preencher, e o
      // botão ficaria travado sem nada na tela explicando o quê.
      montar(['EXECUTOR'], 'empresa-1');

      digitar(fixture, '[data-testid="convite-nome"]', 'Paulo');
      digitar(fixture, '[data-testid="convite-email"]', 'paulo@ipe.com');
      el('[data-testid="enviar-convite"] button')!.click();
      fixture.detectChanges();

      const req = http.expectOne(`${API}/invitations`);
      expect(req.request.body.roles).toEqual(['EXECUTOR']);
      req.flush({ id: 'inv-1' });
    });
  });

  describe('quando há mais de um papel', () => {
    it('deve oferecer uma opção por papel', async () => {
      montar(DO_MARCOS);

      expect(el('[data-testid="papel-unico"]')).toBeNull();
      expect(todos('[data-testid="opcao-de-papel"]').length).toBe(3);
    });

    it('deve ordenar por alçada, e não em ordem alfabética', async () => {
      // Em ordem alfabética "Diretor" — leitura pura — viria antes de "Gestor",
      // e uma lista sugere hierarquia mesmo sem prometer nenhuma.
      montar(TODOS_DO_JOSUÉ);

      expect(opcoesDe(fixture, 'convite-papel')).toEqual([
        'Engenheiro da Consultoria',
        'Técnico',
        'Gestor',
        'Engenheiro do Cliente',
        'Diretor',
        'Executor',
      ]);
    });

    it('deve descrever cada papel, inclusive o que ele não faz', async () => {
      montar(DO_MARCOS);

      const texto = el('[data-testid="convite-papel"]')!.textContent ?? '';

      expect(texto).toContain('não aprova o próprio orçamento');
      expect(texto).toContain('Leitura pura');
    });

    it('deve fazer do cartão inteiro o alvo do clique', async () => {
      // O alvo de toque é a linha toda, não o ponto de 16px do rádio. Quem
      // garante isso é o `for` do rótulo apontando para o `input` de verdade.
      montar(DO_MARCOS);

      for (const opcao of todos('[data-testid="opcao-de-papel"]')) {
        const alvo = opcao.getAttribute('for');
        expect(alvo).toBeTruthy();
        expect(el(`#${alvo}`)).not.toBeNull();
      }
    });
  });

  describe('os títulos de lado', () => {
    it('deve separar consultoria de cliente para quem alcança os dois', async () => {
      // Só o Engenheiro Responsável chega aqui. É por isso que não são abas:
      // elas existiriam para uma única pessoa do sistema, escondendo metade
      // das opções das demais.
      montar(TODOS_DO_JOSUÉ);

      const titulos = todos('[data-testid="titulo-do-lado"]').map((t) => t.textContent?.trim());

      expect(titulos.length).toBe(2);
      expect(titulos[0]).toContain('Na consultoria');
      expect(titulos[1]).toContain('Na empresa cliente');
    });

    it('não deve titular lado nenhum quando só há um', async () => {
      // Os três papéis do Marcos são todos do lado cliente. Um título de grupo
      // sozinho não separa nada — só ocupa uma linha dizendo o óbvio.
      montar(DO_MARCOS);

      expect(todos('[data-testid="titulo-do-lado"]').length).toBe(0);
    });
  });

  describe('o e-mail', () => {
    it('deve reclamar ao lado do campo, e não só no rodapé', async () => {
      montar(DO_MARCOS, 'empresa-1');

      digitar(fixture, '[data-testid="convite-email"]', 'isso-nao-e-email');
      el('[data-testid="convite-email"]')!.dispatchEvent(new Event('blur'));
      fixture.detectChanges();

      const erro = el('#erro-email');
      expect(erro!.textContent).toContain('não parece válido');
      expect(el('[data-testid="convite-email"]')!.getAttribute('aria-describedby')).toBe(
        'erro-email',
      );
    });

    it('não deve reclamar antes de a pessoa passar pelo campo', async () => {
      // Formulário que abre vermelho acusa quem ainda não fez nada.
      montar(DO_MARCOS, 'empresa-1');

      expect(el('#erro-email')!.textContent?.trim()).toBe('');
      expect(el('#erro-nome')!.textContent?.trim()).toBe('');
    });

    it('deve aparar o endereço antes de validar', async () => {
      // `Validators.email` é ancorado: colado com espaço, reprova. Aparar só
      // na hora de enviar chegaria tarde — a recusa já teria acontecido, e com
      // a mensagem mais enganosa possível, porque quem colou está olhando para
      // o endereço certo enquanto lê que ele é inválido.
      montar(DO_MARCOS, 'empresa-1');

      digitar(fixture, '[data-testid="convite-email"]', '  paulo@ipe.com  ');
      el('[data-testid="convite-email"]')!.dispatchEvent(new Event('blur'));
      fixture.detectChanges();

      expect(el('#erro-email')!.textContent?.trim()).toBe('');
    });
  });
});
