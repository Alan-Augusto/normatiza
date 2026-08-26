# Guia Técnico de Testes - Backend (API)

Este documento estabelece as ferramentas, comandos e estruturas técnicas de arquivos para testes automatizados no projeto backend (NestJS).

> [!IMPORTANT]
> A filosofia de testes (TDD-first e foco em comportamento/intenção) é descrita em **[docs/README.md](../README.md)** e deve ser seguida obrigatoriamente.

---

## 🛠️ 1. Frameworks e Ferramentas Adotadas

*   **Testes Unitários e de Integração:** [Jest](https://jestjs.io/) (Nativo e padrão do ecossistema NestJS).
*   **Testes de Endpoints (HTTP E2E):** [Supertest](https://github.com/ladjs/supertest) para simular requisições HTTP sem subir o servidor real na porta de rede.
*   **Mock de Banco de Dados:** Isolamento de queries utilizando mocks de Prisma ou transações de banco de dados de teste dedicados.

---

## 📂 2. Estrutura e Localização dos Arquivos

### A. Testes Unitários de Serviços e Controllers
Devem ficar localizados **lado a lado** com o arquivo de código correspondente:
*   `users.service.ts` ➡️ `users.service.spec.ts`
*   `users.controller.ts` ➡️ `users.controller.spec.ts`

### B. Testes de Integração e E2E da API
Devem ser isolados na pasta `test/` na raiz do projeto da API:
*   `apps/api/test/app.e2e-spec.ts`
*   `apps/api/test/auth.e2e-spec.ts`

### C. Arquivos de configuração
*   `apps/api/jest.config.js` — suíte unitária (`rootDir: src`, arquivos `*.spec.ts`).
*   `apps/api/test/jest-e2e.config.js` — suíte e2e (arquivos `*.e2e-spec.ts`).
*   `apps/api/test/setup-e2e.ts` — carrega o `.env`, força `NODE_ENV=test` e limpa o banco entre os testes.
*   `apps/api/test/reset-db.ts` — truncamento genérico das tabelas.
*   `apps/api/scripts/migrate-test-db.js` — aplica as migrações na branch de teste.

Ambas as configurações carregam `reflect-metadata` antes da suíte: os decorators do Nest e do `class-validator` dependem de `Reflect.getMetadata`.

---

## ✍️ 3. Práticas Técnicas na Escrita de Testes

### 1. Padrão de Nomenclatura e Organização
Organize seus testes agrupando-os por métodos ou endpoints usando blocos `describe`:

```typescript
describe('UsersService', () => {
  let service: UsersService;
  let prisma: PrismaService;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [UsersService, PrismaService],
    }).compile();

    service = module.get<UsersService>(UsersService);
    prisma = module.get<PrismaService>(PrismaService);
  });

  describe('findById', () => {
    it('deve retornar um usuário se ele existir no banco', async () => {
      // Arrange
      const mockUser = { id: '1', name: 'Alan', email: 'alan@test.com' };
      jest.spyOn(prisma.user, 'findUnique').mockResolvedValue(mockUser as any);

      // Act
      const result = await service.findById('1');

      // Assert
      expect(result).toEqual(mockUser);
    });

    it('deve lançar uma NotFoundException caso o usuário não exista', async () => {
      // Arrange
      jest.spyOn(prisma.user, 'findUnique').mockResolvedValue(null);

      // Act & Assert
      await expect(service.findById('2')).rejects.toThrow(NotFoundException);
    });
  });
});
```

### 2. Isolamento de Banco de Dados nos Testes E2E

*   **Branch dedicada no Neon.** A suíte e2e roda contra uma **branch de teste** do Neon, apontada por `TEST_DATABASE_URL` no `.env`. Nunca contra o banco de desenvolvimento: a suíte trunca todas as tabelas, e apontar errado apaga os dados de trabalho. `setup-e2e.ts` e o script de migração **recusam rodar** se `TEST_DATABASE_URL` faltar ou for igual à `DATABASE_URL` — a proteção é do código, não da disciplina de quem roda.
*   **Migrações.** `pnpm prisma:migrate:test` aplica as migrações na branch de teste (`prisma migrate deploy` com a URL trocada no processo filho).
*   **Limpeza.** `resetDatabase` roda em `beforeEach` — na entrada, e não na saída: um teste que quebra no meio deixa o banco sujo, e limpar antes garante que o próximo comece do zero de qualquer jeito. O truncamento lê o catálogo do Postgres em vez de listar models, então cada tabela nova entra na limpeza sozinha.
*   **`--runInBand`.** A suíte e2e é serial por decisão: testes paralelos compartilhariam a mesma branch e um truncaria o banco debaixo do outro.

---

## 💻 4. Scripts e Comandos Utilitários

Na pasta `apps/api/`:
*   `pnpm test`: Executa todos os testes unitários via Jest.
*   `pnpm test:watch`: Executa testes unitários em modo *watch*.
*   `pnpm test:cov`: Gera o relatório de cobertura de código.
*   `pnpm test:e2e`: Executa a suíte de testes E2E/Integração contra a branch de teste do Neon.
*   `pnpm prisma:migrate:test`: Aplica as migrações pendentes na branch de teste.
