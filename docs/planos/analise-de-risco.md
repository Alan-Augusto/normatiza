# Plano — Análise de Risco

> **Status:** decisões tomadas; começa quando os [Catálogos da Análise](./catalogos-da-analise.md) terminarem · **Criado em:** 2026-09-29
> **Regras de negócio:** [03 — Navegação §5.1 e §5.2](../produto/03_navegacao_e_telas.md) · [04 — Modelo de Dados §3 e §4](../produto/04_modelo_de_dados.md) · [01 — Permissões §7](../produto/01_papeis_e_permissoes.md) · [05 — Regras Transversais §1 e §4](../produto/05_regras_transversais.md)
> **Migração:** [docs/migracao §5 e §8](../migracao/README.md)

---

## 1. Objetivo

O assistente de análise do equipamento, nas 4 etapas de 03 §5.2 — ficha técnica, pontos de risco com HRN, PAP e PE — e a conclusão, que congela a análise. Com ele, as colunas "—" do equipamento e da empresa (pior HRN, pontos, última análise) passam a ter número.

**Fora do escopo:**
- gerar as tarefas do plano de ação ao concluir: nasce com a feature do plano de ação, que precisa antes de [06 §1](../produto/06_pendencias.md) (PAP e PE geram tarefa?);
- o app de campo offline;
- o Laudo de Apreciação, os Estudos de Segurança, os modelos de análise e os textos padrão de solução.

## 2. Decisões travadas

| # | Decisão | Definição |
| :-- | :--- | :--- |
| D1 | **Primeiro no painel web, com a API pronta para o offline** | O preenchimento é online e salva por etapa e por item. A API já recebe o que o app offline vai mandar: o id de cada ponto, PAP e PE é gerado no aparelho (UUID), e gravar o mesmo item duas vezes não duplica (`PUT` pelo id). O app de campo vem depois, sobre a mesma API |
| D2 | **Concluir congela e atualiza o equipamento** | A análise e os filhos ficam somente leitura, o equipamento recalcula pior HRN e situação, e a análise guarda a cópia do equipamento (04 §4). As tarefas ficam para o plano de ação (§1) |
| D3 | **Sem HRN residual no formulário** | O residual estimado só existe nos 112 pontos migrados, somente leitura (04 §4) |
| D4 | **A análise guarda a norma** | `norm: 'NR-12'`, sem aparecer em tela (04 §4) |
| D5 | **Quem faz o quê** | Criar e editar: Eng. Responsável, Eng. da Consultoria e Técnico. Concluir: os dois engenheiros. Empresa que não está ativa não conclui ([01 §4](../produto/01_papeis_e_permissoes.md)). O lado cliente lê a análise concluída e não vê o rascunho |

## 3. Fatias

O passo a passo de cada uma se escreve aqui quando ela começar.

1. **Abrir a análise e a etapa 1:** número por equipamento, lista em 03 §5.2, ficha técnica (a ficha do ativo corrige o equipamento), tempos, regime, gestão de segurança e as 4 fotos.
2. **Pontos de risco:** lista, escolha múltipla nos catálogos, calculadora HRN, categoria NBR 14153, foto do perigo.
3. **PAP e PE:** as duas listas, com as seções, as normas e as fotos.
4. **Concluir:** resumo, congelamento, revisão de análise concluída, e os indicadores do equipamento e da empresa.
