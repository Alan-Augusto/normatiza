# 📚 Central de Documentação — Normatiza v2

Mapa de entrada e declaração de princípios obrigatórios para desenvolvedores e agentes de IA que atuam neste repositório.

---

## ⚡ Princípios Globais de Desenvolvimento (Obrigatórios)

### 1. Desenvolvimento Orientado a Testes (TDD-First)
Todo código implementado ou modificado deve passar por testes.
*   **Novas funcionalidades:** criadas em conjunto ou após a escrita de seus testes. Nenhuma funcionalidade vai para produção sem cobertura.
*   **Correção de bugs:** o primeiro passo é **escrever um teste que reproduza a falha** (que ficará vermelho). Só depois corrija o código para fazer o teste passar.

### 2. Testar Intenção, Não Implementação
Os testes devem narrar o comportamento de negócio esperado (o *quê* e o *porquê*), não a estrutura técnica interna (o *como*).
*   **Resiliência a refatoração:** reestruturar métodos privados ou trocar acesso a banco não deve quebrar o teste, desde que o resultado para o usuário ou para a API continue o mesmo.
*   **Evite:** `"deve setar showModal como true ao clicar"` · `"deve chamar findUnique do Prisma"`.
*   **Prefira:** `"deve exibir o painel de documentos quando o usuário solicitar detalhes"` · `"deve retornar os detalhes do usuário se o ID existir"`.

### 3. Uma Verdade Só
A documentação não convive com versões conflitantes da mesma informação. Ao mudar uma regra, corrija o documento — não adicione um aviso de que o anterior está superado. Se algo não vale mais, sai.

---

## 🗺️ Sitemap

### 📘 Produto — o que o sistema é (`docs/produto`)
**Fonte única da verdade sobre regras de negócio.** Toda decisão de implementação deve ser rastreável a um destes documentos.

*   [Índice e ordem de leitura](./produto/README.md)
*   [00 — Visão e Estratégia](./produto/00_visao_e_estrategia.md): o que o sistema é, a virada de paradigma e as consequências arquiteturais.
*   [01 — Papéis, Escopo e Permissões](./produto/01_papeis_e_permissoes.md): os oito papéis, árvore de convites, regras de escopo e matriz de permissões.
*   [02 — O Ciclo de Adequação](./produto/02_ciclo_de_adequacao.md): a máquina de estados de sete etapas e a tabela de transições.
*   [03 — Navegação e Telas](./produto/03_navegacao_e_telas.md): os quatro contextos, a Área de Execução e o detalhamento de cada tela.
*   [04 — Modelo de Dados](./produto/04_modelo_de_dados.md): entidades, relacionamentos e contratos TypeScript.
*   [05 — Regras Transversais](./produto/05_regras_transversais.md): imutabilidade, auditoria, notificações, fotos e migração.
*   [06 — Pendências](./produto/06_pendencias.md): decisões em aberto. **Consulte antes de implementar regra de negócio.**

### 💻 Web App (Angular — `apps/web`)
*   [Arquitetura Web](./web/arquitetura.md): componentização, estrutura de pastas por contexto e isolamento de lógica.
*   [Design System](./web/design_system.md): design tokens do PrimeNG, cores semânticas, regra de cores hardcoded e diretrizes de ícones.
*   [Arquitetura de Estilização](./web/arquitetura_estilizacao.md): engenharia CSS em `rem`, integração do Tailwind v4 via `@theme`, dark mode e sobrescritas.
*   [Guia de Testes](./web/testes.md): Vitest (unitários) e Playwright (E2E).
*   [Roteiro de Implementação](./web/roteiro_implementacao.md): checklist para implementar uma nova tela.

### ⚙️ Backend API (NestJS — `apps/api`)
*   [Guia de Testes API](./backend/testes.md): Jest, Supertest e mocks de Prisma.
*   *Em breve:* estrutura do backend e padronização de endpoints.

### 📱 Mobile App (Ionic + Capacitor — `apps/mobile`)
*   *Em breve:* arquitetura, estilos, testes e estratégia offline.

### 🚀 DevOps e Infraestrutura
*   [Guia de Deploy](./devops/deploy.md): build, CI/CD e ambientes de produção, desenvolvimento e preview.

### 🗄️ Legado (`docs/legado`)
*   [Especificação do sistema anterior](./legado/README.md): acervo congelado do Normatiza em produção (.NET + React). Referência **exclusiva** para migração e preservação de regras históricas de cálculo. Não descreve o que será construído.

---

> [!TIP]
> **Para agentes de IA:** carregue no contexto apenas os documentos da tarefa atual. Para trabalho de produto ou regra de negócio, comece por [`produto/README.md`](./produto/README.md); para trabalho de implementação, siga o guia da plataforma correspondente.
