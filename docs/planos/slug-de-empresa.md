# Plano — Slug da empresa na URL

> **Status:** implementado, falta conferir no homelab · **Criado em:** 2026-09-28
> **Regras de negócio:** [03 — Navegação §4](../produto/03_navegacao_e_telas.md) (o endereço da empresa) · [04 — Modelo de Dados §2](../produto/04_modelo_de_dados.md) (`Company.slug`, `CompanySlugAlias`)

## Objetivo

A URL do Contexto 2 passa de `/app/empresas/cmtacb82v…/painel` para `/app/empresas/brf/painel`.

## Decisões travadas

| # | Decisão |
| :-- | :--- |
| D1 | **O slug é apresentação, a API segue no id.** Só a URL da tela muda. Os endpoints continuam `/companies/:companyId`, e o escopo continua conferido pelo id. A tela troca slug por id com a carteira da sessão (`CompanySummary.slug`). |
| D2 | **Slug antigo resolve pela API.** Um slug que não está na sessão (renomeado, ou empresa fora do escopo) vai a `GET /companies/by-slug/:slug`. Esse endpoint devolve o slug atual quando o pedido era um apelido, e 404 fora do escopo. |
| D3 | **Geração no servidor, função pura em `@normatiza/shared`.** `slugBase(tradeName)` e `candidatosDeSlug(base, cidade)` são testáveis sem banco. O serviço escolhe o primeiro candidato livre entre os slugs vigentes e os apelidos. |
| D4 | **Renome só pelo nome fantasia.** Mudar a cidade não renomeia: o sufixo da cidade só existe por causa de um conflito, e sumir com ele trocaria o endereço sem motivo visível. |
| D5 | **Reservados na `shared`, conferidos contra as rotas.** Um teste em `rotas.spec.ts` falha se uma rota estática nova sob `empresas/` não estiver na lista. |

## Passos

- [x] Shared: `slugBase`, `candidatosDeSlug` e `SLUGS_RESERVADOS_DE_EMPRESA`, com testes na API (`company-rules.spec.ts`).
- [x] Prisma: `Company.slug` com `@@unique([accountId, slug])`, a tabela `company_slug_aliases` e a migração com backfill.
- [x] API: slug na criação e no renome (com apelido), `slug` em `CompanySummary`, na lista e no detalhe, e `GET /companies/by-slug/:slug`. Testes e2e.
- [x] Web: `:companySlug` no lugar de `:companyId`, guarda e layout resolvendo slug por id, `ROTAS.empresa(slug)`, redirecionamento do slug antigo e o teste dos reservados.
- [x] Migração de dados: linha do slug em [`docs/migracao`](../migracao/README.md) (feito).
- [ ] Deploy (a migração roda no serviço `migrate`), conferir no homelab e apagar este plano.
