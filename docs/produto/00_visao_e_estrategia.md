# 00 — Visão e Estratégia do Produto

Este documento estabelece **o que o Normatiza é**, por que ele está sendo reescrito e quais decisões de arquitetura decorrem diretamente dessa escolha. É o ponto de partida obrigatório: todos os demais documentos de produto derivam daqui.

---

## 1. O que o sistema é

Plataforma SaaS de **gestão contínua de segurança de máquinas** sob a NR-12.

A versão anterior era essencialmente um **gerador de laudos**. Na nova versão, o laudo é **consequência** de um ciclo de trabalho gerido dentro do sistema.

---

## 2. A virada de paradigma

### 2.1. O que era

O eixo do sistema antigo era a **Análise**. O engenheiro ia a campo, cadastrava uma análise, inseria os equipamentos, apontava os riscos (HRN) e as falhas estruturais (PAP/PE), e ao final clicava em gerar um PDF.

A limitação era estrutural: **uma vez gerado o PDF, a vida útil daquela informação acabava.** A máquina era um objeto estático pertencente a uma avaliação de uma data específica. Não havia rastreamento de manutenção nem evolução do ativo ao longo dos anos. E o cliente final era espectador — via um dashboard e baixava um documento.

### 2.2. O que passa a ser

O eixo pivota para o **Equipamento (o ativo)**, e o sistema passa a gerir o ciclo completo de adequação — não apenas o diagnóstico.

O sistema tem agora **três fases com donos distintos**:

| Fase | Dono | Entregável |
| :--- | :--- | :--- |
| **1. Diagnóstico** | Consultoria | Análise de risco: ficha técnica, pontos de risco com HRN, PAP, PE → **Laudo de Apreciação de Riscos** |
| **2. Execução** | Empresa cliente | Plano de ação executado: responsáveis, prazos, orçamento, obra física, evidências |
| **3. Certificação** | Consultoria | Conferência das evidências → **Laudo de Adequação** (comparativo antes × depois) |

O detalhamento operacional dessas fases está em [02 — Ciclo de Adequação](./02_ciclo_de_adequacao.md).

---

## 3. Consequências arquiteturais

Estas cinco consequências não são preferências de implementação — decorrem logicamente do modelo acima e valem como restrição para todo o sistema.

1. **A análise é imutável para o lado cliente.**
   Ninguém da empresa altera ponto de risco, HRN, norma descumprida ou solução sugerida.

2. **O plano de ação é uma máquina de estados**, com dono e permissão definidos por etapa — **não um quadro de arrastar livre**.

3. **A autorização é bidimensional:** *quem sou eu* (papel) × *em que etapa está este item* (estado).
   Não basta perguntar "pode editar plano de ação". Ver [01 — Papéis e Permissões](./01_papeis_e_permissoes.md).

4. **A conta é sempre de uma consultoria.**
   Uma indústria que queira usar o sistema para si mesma abre uma conta e ocupa o papel da consultoria. **Não existe um segundo modelo de conta.**

5. **Tudo é rastreável.**
   Com a execução acontecendo entre duas organizações diferentes, o histórico deixa de ser conveniência e vira **prova**.

---

## 4. Por que essa mudança compensa

*   **Retenção e recorrência.** O cliente final (a indústria) passa a usar o software diariamente para gerenciar sua equipe de manutenção, o que justifica cobrança recorrente maior do que a de um gerador de documentos.
*   **Escalabilidade comercial.** O inventário de máquinas já cadastrado vira base para venda de novos serviços de adequação.
*   **Padronização de dados.** Com catálogos de solução e uma base de custos construída pelo uso, o sistema acumula inteligência de mercado — *"quais os principais problemas mecânicos do setor metalúrgico brasileiro?"*.
*   **Valor probatório.** Imutabilidade, versionamento e trilha de auditoria transformam o histórico em documento defensável perante fiscalização.

---

## 5. Escopo tecnológico

Monorepo único (pnpm workspaces), com contratos TypeScript compartilhados entre API, painel web e app de campo:

| App | Stack | Papel |
| :--- | :--- | :--- |
| `apps/api` | NestJS + Prisma + MySQL | API REST |
| `apps/web` | Angular + PrimeNG + Tailwind | Painel da consultoria e do cliente |
| `apps/mobile` | Angular + Ionic + Capacitor | Trabalho de campo, com suporte offline |
| `packages/shared` | TypeScript puro, zero dependências | DTOs e contratos de rede |

O reaproveitamento de tipagem e regras de validação entre os três é intencional: as mesmas regras de HRN e de transição de etapa precisam valer no servidor, no painel e no galpão.

As diretrizes de implementação de cada app vivem fora desta pasta — ver o [sitemap da documentação](../README.md).

---

## 6. Restrições inegociáveis

*   **A fórmula do HRN e as tabelas de peso devem ser idênticas às atuais.** Laudos históricos precisam permanecer reproduzíveis após a migração.
*   **Isolamento absoluto por conta.** Nada atravessa contas, em nenhuma hipótese.
*   **Isolamento absoluto entre empresas do lado cliente.** A BRF nunca enxerga nada da Seara, mesmo sendo atendidas pela mesma consultoria e pelo mesmo engenheiro.
*   **Resiliência offline no campo.** Inspeções acontecem em subsolos e galpões sem internet. O preenchimento de fichas e checklists precisa funcionar sem conexão.
*   **Nenhum registro é apagado.** Usuário desligado vira inativo; análise corrigida gera nova versão; laudo reemitido preserva o anterior.

---

## 7. Documentos relacionados

| Documento | Conteúdo |
| :--- | :--- |
| [01 — Papéis e Permissões](./01_papeis_e_permissoes.md) | Os oito papéis, a árvore de convites, regras de escopo e a matriz de permissões |
| [02 — Ciclo de Adequação](./02_ciclo_de_adequacao.md) | A máquina de estados de sete etapas e as regras derivadas dela |
| [03 — Navegação e Telas](./03_navegacao_e_telas.md) | Os quatro contextos, a Área de Execução e o detalhamento de cada tela |
| [04 — Modelo de Dados](./04_modelo_de_dados.md) | Entidades, relacionamentos e contratos TypeScript |
| [05 — Regras Transversais](./05_regras_transversais.md) | Imutabilidade, auditoria, notificações, fotos e plano de migração |
| [06 — Pendências](./06_pendencias.md) | Decisões ainda em aberto, com o impacto de cada uma |
