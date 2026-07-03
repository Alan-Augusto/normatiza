# Guia Técnico de Testes - Frontend (Web)

Este documento estabelece as ferramentas, comandos e estruturas técnicas de arquivos para testes automatizados no projeto web (Angular v22).

> [!IMPORTANT]
> A filosofia de testes (TDD-first e foco em comportamento/intenção) é descrita em **[docs/README.md](../README.md)** e deve ser seguida obrigatoriamente.

---

## 🛠️ 1. Frameworks e Ferramentas Adotadas

*   **Testes Unitários:** [Vitest](https://vitest.dev/) (Rápido, baseado em Esbuild/Vite, compatível com o ecossistema do builder moderno do Angular).
*   **Ambiente de DOM:** `jsdom` ou `happy-dom`.
*   **Testes E2E (End-to-End):** [Playwright](https://playwright.dev/) (Execução rápida em múltiplos browsers headless).

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

### 2. Isolamento e Mocking de Requisições HTTP
*   **Nunca** faça requisições reais para APIs nos testes unitários do frontend.
*   Utilize o `HttpTestingController` do Angular ou crie *spies/mocks* usando funções do Vitest (`vi.fn()`, `vi.spyOn()`) para simular respostas de serviços de dados.

---

## 💻 4. Scripts e Comandos Utilitários

Na pasta `apps/web/`:
*   `pnpm test`: Executa os testes unitários via Vitest em modo *watch*.
*   `pnpm test:run`: Executa os testes unitários uma única vez (ideal para CI/CD).
*   `pnpm test:coverage`: Gera o relatório de cobertura de código dos testes.
*   `pnpm exec playwright test`: Executa os testes E2E com o Playwright.
