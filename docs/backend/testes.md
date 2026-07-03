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
*   **Banco de Dados de Teste:** Testes E2E/Integração que batem no banco de dados devem utilizar uma base de dados isolada (ex: PostgreSQL com uma URL de conexão separada).
*   **Limpeza do Banco:** Antes de cada suíte de testes (`beforeAll`), execute as migrações no banco de testes. Após cada teste (`afterEach` ou `beforeEach`), limpe as tabelas para garantir que um teste não influencie o resultado do outro.

---

## 💻 4. Scripts e Comandos Utilitários

Na pasta `apps/api/`:
*   `pnpm test`: Executa todos os testes unitários via Jest.
*   `pnpm test:watch`: Executa testes unitários em modo *watch*.
*   `pnpm test:cov`: Gera o relatório de cobertura de código.
*   `pnpm test:e2e`: Executa a suíte de testes E2E/Integração (que batem nos endpoints simulados).
