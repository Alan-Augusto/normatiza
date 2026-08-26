# 06 — Pendências

Decisões ainda em aberto. Cada uma traz o que está indefinido, por que importa e o que muda dependendo da resposta.

Este documento existe para que nenhuma decisão pendente vire uma escolha implícita feita durante a implementação. **Nada aqui deve ser resolvido no código sem antes ser resolvido aqui.**

---

## 1. Origem das tarefas — PAP e PE geram plano de ação?

**Situação.** A regra escrita hoje é: um `RiskPoint` com HRN acima do limite aceitável gera um `ActionItem` ao concluir a análise. Mas a análise produz **três** tipos de apontamento — pontos de risco (HRN), não conformidades de **PAP** e não conformidades de **PE** — e apenas o primeiro está definido como gerador de tarefa.

**Por que importa.** As não conformidades de PAP e PE são exatamente o tipo de coisa que precisa virar obra: botão de emergência ausente, sinalização em português faltando, dispositivo de controle burlado, proteção sem intertravamento. O próprio exemplo usado para ilustrar o ciclo — *"uma máquina cujo único problema é um botão de emergência faltando"* — é um item de PAP, não um ponto de HRN. Do jeito que a regra está escrita, esse caso não geraria tarefa nenhuma.

**O que muda conforme a resposta:**

| Se… | Impacto |
| :--- | :--- |
| **Só HRN gera tarefa** | Modelo atual serve. Mas não conformidades de PAP/PE ficam apenas no Laudo de Apreciação, sem acompanhamento de correção — e como o portão do laudo conta apenas itens do plano de ação, o Laudo de Adequação pode ser emitido com um botão de emergência ainda faltando |
| **PAP e PE também geram** | `ActionItem.riskPointId` precisa virar uma origem polimórfica (`sourceType` + `sourceId`). O cartão do ponto muda: itens de PAP/PE não têm HRN, logo não têm HRN residual — a etapa 7 precisa de um critério de conformação alternativo |
| **Geram, mas em fluxo separado** | Duas listas de trabalho no plano de ação, com regras distintas de portão de laudo |

**Recomendação para discussão:** a segunda opção parece a mais fiel ao que o sistema promete, mas exige decidir o que substitui o HRN residual como prova de conformação para itens de checklist.

---

## 2. Reanálise periódica

**Situação.** A NR-12 pressupõe revisão periódica. O sistema deve programar reanálises — anual, por exemplo — e alertar quando vencerem?

**Por que importa.** Não muda a estrutura, mas **muda o produto**: transforma o sistema de "projeto com fim" em "assinatura contínua". É a diferença entre vender um serviço e vender uma mensalidade.

**Impacto se sim:** o campo `Equipment.nextReviewAt` já está previsto no modelo; seria preciso adicionar um bloco de vencimentos ao Dashboard Geral, um evento ao modelo de notificação e uma política de periodicidade configurável por conta ou por equipamento.

---

## 3. Diretor e visibilidade de custo

**Situação.** O Diretor vê os valores dos planos de ação?

**Argumento a favor.** É justamente ele quem se importa com investimento — o dashboard executivo mostra "investimento aprovado no período", e omitir valores esvazia o papel.

**Argumento contra.** É o único papel de leitura pura e enxerga a empresa inteira, incluindo orçamentos que talvez não devessem circular.

A matriz de permissões hoje marca `○` (leitura) para o Diretor na tabela de preços e nos relatórios gerenciais, o que implica que sim. Vale confirmar explicitamente.

---

## 4. Multi-normas — NR-10 continua no plano?

**Situação.** O documento de reestruturação inicial previa explicitamente o sistema como multi-normas, com um **Módulo NR-10** (segurança elétrica, painéis, arco elétrico, aterramento) como próxima extensão sobre o mesmo inventário de máquinas — e usava isso como argumento comercial de cross-selling. A estrutura consolidada com o dono do produto é **NR-12 pura**, sem menção a NR-10.

**A pergunta.** O multi-normas saiu do plano, ou saiu apenas do horizonte imediato?

**Por que importa agora, e não depois.** É uma decisão de modelagem, não de roadmap. Se NR-10 vier depois, `Analysis` precisa nascer com uma noção de "sob qual norma esta avaliação foi feita", e o `Equipment` precisa comportar múltiplas análises de naturezas diferentes convivendo. Adicionar isso depois, com base migrada e laudos emitidos, é caro. Deixar previsto agora custa um campo.

**Recomendação:** decidir apenas se o modelo deve reservar o eixo de norma, mesmo que só a NR-12 seja implementada. O catálogo `Standard` já tem `groupCode`, o que é meio caminho.

---

## 5. Acervo de fotos na migração

**Situação.** As fotos do sistema legado estão no Firebase Storage, organizadas por pasta de cliente. Na migração, mantém-se as referências existentes ou reprocessa-se o acervo?

**O que pesa.** Reprocessar permite padronizar compressão, gerar os thumbnails que o novo modelo exige e normalizar metadados — mas é uma operação longa sobre um volume grande, e as fotos de laudos já emitidos são prova, não podem ser degradadas.

**Encaminhamento provável.** Migrar referências sem reprocessar os originais, gerando apenas thumbnails sob demanda. Precisa ser confirmado antes de escrever o migrador.

---

## Como usar este documento

Ao resolver uma pendência:
1. Escreva a decisão no documento de produto correspondente (`00` a `05`).
2. **Remova a entrada daqui** — não deixe registro de decisão tomada em documento de pendências.
3. Se a decisão invalidar algo já escrito em outro documento, corrija lá também. A documentação não convive com duas verdades.
