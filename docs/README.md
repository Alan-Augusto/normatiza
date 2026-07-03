# 📚 Central de Documentação - Normatiza v2

Este arquivo funciona como o mapa de entrada e a declaração de princípios obrigatórios para desenvolvedores e agentes de IA que atuam no repositório do projeto Normatiza v2.

---

## ⚡ Princípios Globais de Desenvolvimento (Obrigatórios)

Qualquer alteração ou nova funcionalidade inserida nas aplicações deve seguir estritamente as diretrizes abaixo:

### 1. Desenvolvimento Orientado a Testes (TDD-First)
Todo código implementado ou modificado deve passar por testes. 
*   **Novas Funcionalidades:** Toda nova feature deve ser criada em conjunto ou após a escrita de seus respectivos testes. Nenhuma funcionalidade vai para produção sem cobertura.
*   **Correção de Bugs:** Ao encontrar ou receber um bug relatado, o primeiro passo é **escrever um teste que reproduza a falha** (que ficará vermelho). Somente após isso você deve corrigir a falha no código para fazer o teste passar.

### 2. Testar Intenção, Não Funcionalidade (Comportamento vs Implementação)
Nossos testes (tanto frontend quanto backend) devem narrar o comportamento de negócio esperado (o *"Quê"* e o *"Porquê"*) e não a estrutura técnica interna do código (o *"Como"*).
*   **Resiliência a Refatoração:** Refatorações de código de banco de dados ou reestruturação de métodos privados não devem quebrar o teste, desde que o resultado final para o usuário ou API continue sendo respeitado.
*   **Evite:** `"deve setar showModal como true ao clicar"` ou `"deve chamar o método findUnique do Prisma"`.
*   **Prefira:** `"deve exibir o painel de documentos quando o usuário solicitar detalhes"` ou `"deve retornar os detalhes do usuário se o ID fornecido existir no banco"`.

---

## 🗺️ Sitemap da Documentação

### 💻 Web App (Angular v22 - `apps/web`)
*   [Arquitetura Web](./web/arquitetura.md): Diretrizes de criação de componentes, estrutura de pastas por feature e regras de isolamento de lógica.
*   [Design System Web](./web/design_system.md): Conceito de Design Tokens do PrimeNG, tabelas de cores semânticas, regra de cores hardcoded e diretrizes de ícones (Lucide vs PrimeIcons).
*   [Arquitetura de Estilização Web](./web/arquitetura_estilizacao.md): Engenharia CSS em `rem`, integração técnica do Tailwind v4 via `@theme`, dark mode e regras de sobrescrita.
*   [Guia Técnico de Testes Web](./web/testes.md): Configurações e comandos práticos de execução com Vitest (unitários) e Playwright (E2E).
*   [Roteiro de Implementação Web](./web/roteiro_implementacao.md): Checklist e passo a passo rápido para implementar uma nova tela no front-end web.

### 📱 Mobile App (React Native / Expo - `apps/mobile`)
*   *Em breve:* Diretrizes de arquitetura, estilos e testes para o aplicativo mobile.

### ⚙️ Backend API (NestJS - `apps/api`)
*   *Em breve:* Estrutura do backend e padronização de endpoints.
*   [Guia Técnico de Testes API](./backend/testes.md): Configuração de testes unitários Jest, testes HTTP com Supertest e mocks de banco de dados (Prisma).

### 🚀 DevOps e Infraestrutura
*   [Guia de Deploy](./devops/deploy.md): Passo a passo de build, publicação e configurações de ambiente de produção e homologação.

---

> [!TIP]
> **Para Agentes de IA:** Sempre consulte os princípios acima e use os links deste sitemap para carregar no seu contexto de prompt apenas as diretrizes exatas necessárias para realizar a tarefa atual.
