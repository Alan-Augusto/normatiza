# 📘 Documentação de Produto — Normatiza

Esta pasta é a **fonte única da verdade** sobre o que o Normatiza faz, para quem, e sob que regras. Toda decisão de implementação — modelagem, autorização, tela, endpoint — deve ser rastreável a um destes documentos.

> **Não existe documentação obsoleta aqui.** Se um trecho não vale mais, ele é corrigido ou removido, nunca marcado como superado. A especificação do sistema anterior vive separada, em [`docs/legado/`](../legado/README.md), e serve exclusivamente como referência de migração.

---

## Ordem de leitura

| # | Documento | Leia quando precisar de… |
| :-: | :--- | :--- |
| 00 | [Visão e Estratégia](./00_visao_e_estrategia.md) | Entender o que o sistema é e por que foi reescrito. **Começa aqui.** |
| 01 | [Papéis, Escopo e Permissões](./01_papeis_e_permissoes.md) | Qualquer decisão de autorização, convite, escopo ou isolamento de dados |
| 02 | [O Ciclo de Adequação](./02_ciclo_de_adequacao.md) | Implementar plano de ação, transições de etapa ou regras de aprovação |
| 03 | [Navegação e Telas](./03_navegacao_e_telas.md) | Construir uma tela, definir uma rota ou entender onde uma funcionalidade mora |
| 04 | [Modelo de Dados](./04_modelo_de_dados.md) | Modelar schema, escrever DTOs ou definir contratos de API |
| 05 | [Regras Transversais](./05_regras_transversais.md) | Imutabilidade, auditoria, notificação, fotos e migração |
| 06 | [Pendências](./06_pendencias.md) | Antes de implementar algo que dependa de uma decisão ainda não tomada |

---

## As cinco regras que governam tudo

Se você só puder guardar cinco coisas desta pasta, que sejam estas:

1. **O laudo é consequência de um ciclo, não o produto final.** Diagnóstico (consultoria) → Execução (cliente) → Certificação (consultoria).
2. **A análise é imutável para o lado cliente.** Ninguém da empresa toca em ponto de risco, HRN, norma descumprida ou solução sugerida.
3. **O plano de ação é uma máquina de estados**, com dono por etapa — não um quadro de arrastar livre.
4. **A autorização é bidimensional:** papel × etapa atual do item. Perguntar só o papel é insuficiente.
5. **Carteira de várias empresas existe só do lado consultoria.** Todo papel do lado cliente pertence a uma única empresa.

---

## Para agentes de IA

Carregue apenas o documento correspondente à sua tarefa — a tabela acima existe para isso. Antes de implementar qualquer regra de negócio, verifique em [06 — Pendências](./06_pendencias.md) se a decisão já foi tomada. **Não resolva uma pendência escrevendo código.**

Os princípios de engenharia (TDD, testes de intenção) e as diretrizes por plataforma estão no [sitemap geral](../README.md).
