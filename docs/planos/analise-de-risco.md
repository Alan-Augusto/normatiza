# Plano — Análise de Risco

> **Status:** fatia 1 concluída (21 e2e e 14 testes de tela novos), falta o aceite no homelab · fatia 2 a seguir · **Criado em:** 2026-09-29 · os catálogos (normas, perigos, proteções, tabela HRN) já existem: `GET /catalogs/analysis`, `@normatiza/shared` `analysis/`
> **Regras de negócio:** [03 — Navegação §5.1 e §5.2](../produto/03_navegacao_e_telas.md) · [04 — Modelo de Dados §3 e §4](../produto/04_modelo_de_dados.md) · [01 — Permissões §7](../produto/01_papeis_e_permissoes.md) · [05 — Regras Transversais §1 e §4](../produto/05_regras_transversais.md)
> **Migração:** [docs/migracao §5 e §8](../migracao/README.md)

---

## 1. Objetivo

O assistente de análise do equipamento, nas 4 etapas de 03 §5.2 — ficha técnica, pontos de risco com HRN, PAP e PE — e a conclusão, que congela a análise. Com ele, as colunas "—" do equipamento e da empresa (pior HRN, pontos, última análise) passam a ter número.

**Fora do escopo:**
- gerar as tarefas do plano de ação ao concluir: nasce com a feature do plano de ação, que precisa antes de [06 §1](../produto/06_pendencias.md) (PAP e PE geram tarefa?);
- o app de campo offline;
- o Laudo de Apreciação, os Estudos de Segurança, os modelos de análise e os textos padrão de solução;
- as telas de manutenção dos catálogos (Contexto 0) e "Meus Cadastros". Os dois códigos tortos do legado ficam para lá ([migracao §7](../migracao/README.md)).

## 2. Decisões travadas

| # | Decisão | Definição |
| :-- | :--- | :--- |
| D1 | **Primeiro no painel web, com a API pronta para o offline** | O preenchimento é online e salva por etapa e por item. A API já recebe o que o app offline vai mandar: o id de cada ponto, PAP e PE é gerado no aparelho (UUID), e gravar o mesmo item duas vezes não duplica (`PUT` pelo id). O app de campo vem depois, sobre a mesma API |
| D2 | **Concluir congela e atualiza o equipamento** | A análise e os filhos ficam somente leitura, o equipamento recalcula pior HRN e situação, e a análise guarda a cópia do equipamento (04 §4). As tarefas ficam para o plano de ação (§1) |
| D3 | **Sem HRN residual no formulário** | O residual estimado só existe nos 112 pontos migrados, somente leitura (04 §4) |
| D4 | **A análise guarda a norma** | `norm: 'NR-12'`, sem aparecer em tela (04 §4) |
| D5 | **Quem faz o quê** | Criar e editar: Eng. Responsável, Eng. da Consultoria e Técnico. Concluir: os dois engenheiros. Empresa que não está ativa não conclui ([01 §4](../produto/01_papeis_e_permissoes.md)). O lado cliente lê a análise concluída e não vê o rascunho |
| D6 | **Rascunho: um por equipamento, descartável, sem obrigatório** | As regras de 03 §5.2. O "um por equipamento" é índice parcial no banco (`WHERE status = 'DRAFT'`), e não só checagem: dois técnicos clicando juntos não abrem dois |
| D7 | **Número por equipamento, dado na criação** | O próximo depois do maior que existe. Descartar o rascunho libera o número dele: a lista nunca pula da Análise 1 para a 3 |
| D8 | **A ficha do ativo se corrige no cadastro do equipamento** | A etapa 1 mostra a ficha do equipamento, e **Corrigir** abre o formulário do equipamento, que volta para a análise ao salvar. Um segundo formulário da mesma ficha dentro da análise seria duas telas para manter iguais |
| D9 | **Rotas** | API: `/companies/:companyId/equipments/:code/analyses[/:number[/sheet|/photos/:view]]`. Painel: `…/equipamentos/:equipmentCode/analise` (lista) e `…/analise/:numero` (assistente) |
| D10 | **Criar aceita o id do aparelho** | `POST …/analyses` com `id` (UUID) opcional: se já existe aquela análise naquele equipamento, devolve a existente. O app offline reenvia sem medo de duplicar (D1) |

## 3. Fatias

O passo a passo de cada uma se escreve aqui quando ela começar.

### Fatia 1 — abrir a análise e a etapa 1
- [x] Docs: regras do rascunho em 03 §5.2.
- [x] Prisma: `Analysis` (número, revisão, norma, status, técnico, engenheiro, ART, tabela HRN, tempos, regime, gestão de segurança, 4 fotos) e `FileAsset.analysisId`. Índice parcial de um rascunho por equipamento.
- [x] Shared: contratos, as 6 perguntas com o texto do legado, `ANALYSIS_EDITOR_ROLES`.
- [x] API: listar, criar (D10), abrir, salvar a etapa 1, enviar e remover foto, descartar. O cliente não vê rascunho. Equipamento com análise não se exclui.
- [x] Testes de API: alçada por papel, rascunho único, número, descarte, técnico de outra empresa recusado, fotos.
- [x] Painel: lista na aba Análises, **Nova análise**, assistente com a etapa 1 e as outras três anunciadas, descartar. O técnico de campo vem de `GET …/analyses/field-technicians` (a Equipe da Empresa mostra a consultoria só como contexto), e o formulário do equipamento aceita `?voltar=` só para endereço interno.
- [ ] Aceite no homelab: Fernando abre, preenche e envia fotos; Marcos não vê o rascunho; descartar libera a máquina.
- [x] Testes do painel.

### Próximas
1. **Abrir a análise e a etapa 1:** número por equipamento, lista em 03 §5.2, ficha técnica (a ficha do ativo corrige o equipamento), tempos, regime, gestão de segurança e as 4 fotos.
2. **Pontos de risco:** lista, escolha múltipla nos catálogos, calculadora HRN, categoria NBR 14153, foto do perigo.
3. **PAP e PE:** as duas listas, com as seções, as normas e as fotos.
4. **Concluir:** resumo, congelamento, revisão de análise concluída, e os indicadores do equipamento e da empresa.
