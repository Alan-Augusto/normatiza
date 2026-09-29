# Plano — Catálogos da Análise

> **Status:** planejado, esperando a exportação do legado (Fase 0) · **Criado em:** 2026-09-29
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
| D5 | **O HRN é calculado em inteiros** | Os pesos são guardados multiplicados por 100 (0,03 → 3). Em ponto flutuante, `0.5 × 0.03 × …` pode dar `5.000000001` e mudar a faixa. O cálculo e a classificação moram em `packages/shared`, e API, painel e app usam o mesmo |
| D6 | **A faixa segue o laudo do legado** | "Acima de 1 até 5"… (04 §7). O teste percorre as 1.680 combinações de pesos contra a regra do laudo, e o 1,08 tem que dar Muito Baixo |
| D7 | **A categoria NBR 14153 também é compartilhada** | A mesma função calcula a categoria das três respostas, com a regra do legado (04 §4) |
| D8 | **Um endpoint entrega tudo** | `GET /catalogs/analysis` devolve capítulos com itens, perigos por tipo, proteções por tipo e a tabela HRN vigente — cerca de mil itens, lidos uma vez e guardados. É o mesmo pacote que o app offline vai baixar, como o legado fazia no login. `Cache-Control` com `ETag` pela versão. Prefixo `catalogs` no `nginx.conf` |
| D9 | **Ordem dos capítulos** | Os 12.x pela numeração, depois os anexos pela numeração romana. Os itens, pelo código em ordem natural (12.2 antes de 12.10) |

## 4. Passos

### Fase 0 — Dados
- [ ] Rodar `exportar-catalogos.sql` no legado e salvar em `apps/api/prisma/catalogos/legado.json`.
- [ ] Conferir as contagens por tabela contra §2.

### Fase 1 — Schema
- [ ] Prisma: `StandardSection`, `Standard`, `HazardType`, `HazardOrigin`, `HazardConsequence`, `ProtectionType`, `Protection`, `LegacyRef`, `HrnTableVersion` (fatores e faixas).
- [ ] Migração com a tabela HRN inicial semeada (D4).
- [ ] Aplicar no banco de teste e no de dev (é aditiva; o homelab antigo não a enxerga).

### Fase 2 — Cálculo compartilhado
- [ ] `packages/shared`: fatores, faixas, `calcularHrn` e `categoriaNbr14153`, em inteiros (D5).
- [ ] Testes: as 1.680 combinações contra a regra do laudo; o 1,08; as quatro saídas da categoria.

### Fase 3 — Importador
- [ ] `apps/api/scripts/legado/importar-catalogos.ts` e o script `catalogos:importar` no `package.json`.
- [ ] Testes: carrega um arquivo pequeno; rodar duas vezes não duplica; texto alterado atualiza; item removido fica e é listado; item com pai inexistente é recusado com o id.

### Fase 4 — Endpoint
- [ ] `GET /catalogs/analysis` com a ordem de D9 e `ETag` (D8).
- [ ] Prefixo no `nginx.conf` e conferência contra as rotas do Angular.
- [ ] e2e: qualquer pessoa logada lê; sem login, 401.

### Fase 5 — Fechamento
- [ ] Rodar o importador no banco de dev (é o mesmo do homelab).
- [ ] Atualizar [`docs/migracao`](../migracao/README.md) com o que a implementação decidiu.
- [ ] Apagar este plano.
