-- O slug da empresa: o trecho legível da URL do Contexto 2 (docs/produto/03 §4).

ALTER TABLE "companies" ADD COLUMN "slug" TEXT;

-- As empresas que já existem ganham o slug do nome fantasia, pela mesma regra
-- de `slugBase` (@normatiza/shared): sem acento, minúsculas, hífens, sem o
-- sufixo societário no fim. A regra completa vive no TypeScript; aqui é só o
-- suficiente para os bancos de hoje, que têm poucas empresas. Um empate na conta
-- ganha o fim do id — feio, mas único, e o próximo renome o corrige.
UPDATE "companies" SET "slug" = trim(both '-' from regexp_replace(
  regexp_replace(
    lower(translate("tradeName",
      'áàâãäåéèêëíìîïóòôõöúùûüçñÁÀÂÃÄÅÉÈÊËÍÌÎÏÓÒÔÕÖÚÙÛÜÇÑ',
      'aaaaaaeeeeiiiiooooouuuucnaaaaaaeeeeiiiiooooouuuucn')),
    '[^a-z0-9]+', '-', 'g'),
  '-(ltda|s-a|sa|me|epp|eireli)$', ''));

UPDATE "companies" SET "slug" = 'empresa' WHERE "slug" = '';

UPDATE "companies" c SET "slug" = c."slug" || '-' || right(c."id", 6)
FROM (
  SELECT "id", row_number() OVER (PARTITION BY "accountId", "slug" ORDER BY "createdAt") AS n
  FROM "companies"
) d
WHERE d."id" = c."id" AND d.n > 1;

ALTER TABLE "companies" ALTER COLUMN "slug" SET NOT NULL;

CREATE UNIQUE INDEX "companies_accountId_slug_key" ON "companies"("accountId", "slug");

-- CreateTable
CREATE TABLE "company_slug_aliases" (
    "id" TEXT NOT NULL,
    "accountId" TEXT NOT NULL,
    "companyId" TEXT NOT NULL,
    "slug" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "company_slug_aliases_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "company_slug_aliases_accountId_slug_key" ON "company_slug_aliases"("accountId", "slug");
CREATE INDEX "company_slug_aliases_companyId_idx" ON "company_slug_aliases"("companyId");

ALTER TABLE "company_slug_aliases" ADD CONSTRAINT "company_slug_aliases_companyId_fkey" FOREIGN KEY ("companyId") REFERENCES "companies"("id") ON DELETE CASCADE ON UPDATE CASCADE;
