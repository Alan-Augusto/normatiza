# Guia Técnico de Testes - Frontend (Web)

Este documento estabelece as ferramentas, comandos e estruturas técnicas de arquivos para testes automatizados no projeto web (Angular v22).

> [!IMPORTANT]
> A filosofia de testes (TDD-first e foco em comportamento/intenção) é descrita em **[docs/README.md](../README.md)** e deve ser seguida obrigatoriamente.

---

## 🛠️ 1. Frameworks e Ferramentas Adotadas

*   **Testes Unitários:** [Vitest](https://vitest.dev/), executado pelo builder nativo `@angular/build:unit-test` (alvo `test` do `angular.json`).
*   **Ambiente de DOM:** `jsdom`.
*   **Testes E2E (End-to-End):** [Playwright](https://playwright.dev/) — **ainda não instalado.** A seção 2.B e o comando correspondente descrevem o destino, não o estado atual.

> **Sobre o `matchMedia`.** O jsdom não implementa `window.matchMedia`, e os
> componentes do PrimeNG a consultam ao montar — sem ela, um teste que renderize
> `p-select` ou `p-dialog` explode antes de a tela aparecer. O polyfill vive em
> [`src/test-setup.ts`](../../apps/web/src/test-setup.ts), registrado em
> `setupFiles` no alvo `test` do `angular.json`.
>
> **Sobre o `zone.js`.** A aplicação é *zoneless* e continua sendo. O pacote existe como dependência de desenvolvimento apenas porque o `init-testbed` do builder contém um `import('zone.js/testing')` que o Vite precisa resolver em tempo de build, mesmo dentro de um ramo que nunca executa.

---

## 📂 2. Estrutura e Localização dos Arquivos

### A. Testes Unitários e de Componente
Devem ficar localizados **lado a lado** com o arquivo de código correspondente:
*   `login.component.ts` ➡️ `login.component.spec.ts`
*   `auth.service.ts` ➡️ `auth.service.spec.ts`

### B. Testes E2E (End-to-End)
Centralizados na pasta `e2e/` na raiz do projeto frontend:
*   `apps/web/e2e/auth.spec.ts`
*   `apps/web/e2e/documents-flow.spec.ts`

---

## ✍️ 3. Práticas Técnicas na Escrita de Testes

### 1. Padrão de Nomenclatura (AAA - Arrange, Act, Assert)
Estruture cada bloco de teste de forma legível seguindo as três fases:
1.  **Arrange (Preparar):** Configurar o estado inicial, mocks e variáveis.
2.  **Act (Agir):** Executar a ação ou método que está sendo testado.
3.  **Assert (Verificar):** Validar se o resultado gerado é o esperado.

```typescript
it('deve autenticar o usuário com credenciais válidas', async () => {
  // Arrange
  const credentials = { email: 'test@normatiza.com', password: '123' };
  vi.spyOn(authService, 'login').mockReturnValue(of({ token: 'mock-token' }));

  // Act
  component.email.setValue(credentials.email);
  component.password.setValue(credentials.password);
  component.onSubmit();

  // Assert
  expect(authService.login).toHaveBeenCalledWith(credentials);
  expect(router.navigate).toHaveBeenCalledWith(['/app/dashboard']);
});
```

### 2. Dirigindo componentes do PrimeNG

Um `p-select` não é um `<select>`: escrever `.value = 'MANAGER'` nele não faz
nada, porque ele monta a própria lista. O mesmo vale para `p-checkbox` (o clique
vai no `<input>` interno) e para `p-button` (o `<button>` de verdade fica
**dentro** do elemento marcado, e é ele que carrega o `disabled`).

Esse conhecimento vive num lugar só —
[`core/testing/prime.ts`](../../apps/web/src/app/core/testing/prime.ts) — e os
testes falam de intenção:

```typescript
escolher(fixture, 'filtro-papel', 'Gestor');       // abre e escolhe pelo rótulo
expect(opcoesDe(fixture, 'convite-papel')).toEqual(['Técnico']);
marcar(fixture, 'papel-DIRECTOR');
clicar(fixture, '[data-testid="salvar-papeis"] button');
```

Note que `opcoesDe` devolve **rótulos**, não valores: um teste que afirmasse
`['TECHNICIAN']` estaria conferindo o enum do banco. O que importa é que a
Carla vê "Técnico" e mais nada.

### 3. Isolamento e Mocking de Requisições HTTP
*   **Nunca** faça requisições reais para APIs nos testes unitários do frontend.
*   Utilize o `HttpTestingController` do Angular ou crie *spies/mocks* usando funções do Vitest (`vi.fn()`, `vi.spyOn()`) para simular respostas de serviços de dados.

---

## 💻 4. Scripts e Comandos Utilitários

Na pasta `apps/web/`:
*   `pnpm test`: Executa os testes unitários uma única vez (é o que roda em CI).
*   `pnpm test:watch`: Reexecuta a cada alteração de arquivo — o modo do dia a dia.
*   `pnpm test:coverage`: Gera o relatório de cobertura.
*   `pnpm exec playwright test`: E2E — **disponível quando o Playwright for instalado.**
