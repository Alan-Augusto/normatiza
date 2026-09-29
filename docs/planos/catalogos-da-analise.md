# Plano — Catálogos da Análise

> **Status:** Fases 0–4 concluídas — 18 unitários e 11 e2e novos · falta o fechamento (5): migração e importação no banco de dev · **Criado em:** 2026-09-29
> **Regras de negócio:** [04 — Modelo de Dados §4 e §7](../produto/04_modelo_de_dados.md) · [03 — Navegação §2.3 e §5.2](../produto/03_navegacao_e_telas.md) · [05 — Regras Transversais §1 e §6](../produto/05_regras_transversais.md)
> **Migração:** [docs/migracao §1 (identificador de origem), §7 e §8](../migracao/README.md)
> **Feature seguinte:** [Análise de Risco](./analise-de-risco.md), que depende desta

---

## 1. Objetivo

Deixar prontas as listas de onde o engenheiro escolhe as opções da análise — itens da NR-12, perigos, proteções — e a tabela do HRN, com o cálculo compartilhado entre API, painel e app. Os dados vêm do legado, por um arquivo exportado agora; a migração oficial reaproveita o mesmo importador.

**Fora do escopo:**
- telas de manutenção dos catálogos (Contexto 0, 03 §2.3) e "Meus Cadastros" (03 §3.6). O `accountId` dos catálogos da consultoria entra com eles;
- nova versão da tabela HRN: só existe a inicial, idêntica ao legado.

## 2. Estado atual

| Item | Situação |
| :--- | :--- |
| Catálogos da análise | Não existem no Prisma. Só `MachineType`, semeado na migração |
| Identificador de origem | Decidido: tabela única `legacy_refs` ([migracao §1](../migracao/README.md)). Ainda não existe |
| HRN | Só na documentação. Nenhum cálculo no código |
| Legado | 27 capítulos e anexos, 857 itens de norma, 10 tipos de perigo, 82 origens, 68 consequências, 9 tipos de proteção, 28 dispositivos. Nenhum peso de HRN gravado fora da tabela, em 287.921 pontos |

## 3. Decisões travadas

| # | Decisão | Definição |
| :-- | :--- | :--- |
| D1 | **Os dados entram por arquivo, que fica no repositório** | `apps/api/scripts/legado/exportar-catalogos.sql` roda no legado, e o resultado vai para `apps/api/prisma/catalogos/legado.json`. Com o arquivo versionado, todo ambiente (teste, dev, homelab) carrega o mesmo catálogo, e a migração oficial só troca o arquivo por uma exportação recente |
| D2 | **`legacy_refs (entity, legacyId, newId)`** | Único por `(entity, legacyId)`. É o que liga as análises migradas aos catálogos. Os catálogos são os primeiros a usá-la |
| D3 | **O importador é idempotente e não apaga** | Acha cada item pelo `legacy_refs`: se existe, atualiza nome e texto; se não, cria. O item que sumiu do arquivo continua na v2 (pode haver análise apontando para ele) e é listado no fim. Rodar duas vezes seguidas não muda nada |
| D4 | **A tabela HRN é semeada na migração do Prisma** | Como os tipos de máquina: existe em todo ambiente sem depender de script. Os valores são os de 04 §7 |
| D5 | **O HRN é calculado em inteiros** | O cálculo converte cada peso para centésimos inteiros (0,03 → 3) e compara o produto com as faixas na mesma escala. Em ponto flutuante, `0.5 × 0.03 × …` pode dar `5.000000001` e mudar a faixa. O cálculo e a classificação moram em `packages/shared`, e API, painel e app usam o mesmo |
| D6 | **A faixa segue o laudo do legado** | "Acima de 1 até 5"… (04 §7). O teste percorre as 1.680 combinações de pesos contra a regra do laudo, e o 1,08 tem que dar Muito Baixo |
| D7 | **A categoria NBR 14153 também é compartilhada** | A mesma função calcula a categoria das três respostas, com a regra do legado (04 §4) |
| D8 | **Um endpoint entrega tudo** | `GET /catalogs/analysis` devolve capítulos com itens, perigos por tipo, proteções por tipo e a tabela HRN vigente — cerca de mil itens, lidos uma vez e guardados. É o mesmo pacote que o app offline vai baixar, como o legado fazia no login. `Cache-Control` com `ETag` pela versão. Prefixo `catalogs` no `nginx.conf` |
| D9 | **Ordem dos capítulos** | Os 12.x pela numeração, depois os anexos pela numeração romana. Os itens, pelo código em ordem natural (12.2 antes de 12.10) |

## 4. Passos

### Fase 0 — Dados
- [x] Rodar `exportar-catalogos.sql` no legado e salvar em `apps/api/prisma/catalogos/legado.json`.
- [x] Conferir as contagens por tabela contra §2: 1.081 linhas, nenhum pai inexistente. Os dois códigos tortos estão em [migracao §7](../migracao/README.md).

### Fase 1 — Schema
- [x] Prisma: `StandardSection`, `Standard`, `HazardType`, `HazardOrigin`, `HazardConsequence`, `ProtectionType`, `Protection`, `LegacyRef`, `HrnTableVersion` (fatores e faixas).
- [x] Migração com a tabela HRN inicial semeada (D4). Um teste confere o INSERT contra `HRN_TABLE_LEGACY`.
- [x] Aplicar no banco de teste.
- [ ] Aplicar no banco de dev (é aditiva; o homelab antigo não a enxerga) — Fase 5.

### Fase 2 — Cálculo compartilhado
- [x] `packages/shared/src/analysis`: `HRN_TABLE_LEGACY`, `calculateHrn`, `hrnLevel`, `requiresAction` e `safetyCategory`, em inteiros (D5).
- [x] Testes (`apps/api/src/catalogs/hrn.spec.ts`): as 1.680 combinações contra a regra do laudo; o 1,08; as quatro saídas da categoria.

### Fase 3 — Importador
- [x] `src/catalogs/legacy-catalog-import.ts`, o comando `scripts/legado/importar-catalogos.ts` e `catalogos:importar` no `package.json`. A carga é em lote, numa transação: ou o arquivo entra todo, ou nada. O importador também cria a tabela HRN se ela faltar (o banco de teste é truncado a cada teste).
- [x] Testes: carrega um arquivo pequeno; rodar duas vezes não duplica; texto alterado atualiza; item removido fica e é listado; item com pai inexistente é recusado com o id.

### Fase 4 — Endpoint
- [x] `GET /catalogs/analysis` com a ordem de D9 e `ETag` (D8). A versão é um hash do conteúdo, e o Express responde 304 sozinho.
- [x] Prefixo no `nginx.conf`. Nenhuma tela usa `/catalogs` (a de soluções é `/app/catalogos/…`).
- [x] e2e: sem login, 401; ordem dos capítulos e itens; agrupamento por tipo; tabela HRN igual à compartilhada; 304 e versão nova.

### Fase 5 — Fechamento
- [ ] Rodar o importador no banco de dev (é o mesmo do homelab).
- [x] Atualizar [`docs/migracao`](../migracao/README.md) com o que a implementação decidiu.
- [ ] Apagar este plano.
