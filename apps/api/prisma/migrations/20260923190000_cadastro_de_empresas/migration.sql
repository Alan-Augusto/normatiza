-- CreateEnum
CREATE TYPE "FileVisibility" AS ENUM ('CONSULTANCY_ONLY', 'CLIENT_VISIBLE');

-- AlterTable
-- `isActive` vira `deactivatedAt`: só a desativação é gravada, os demais
-- status são derivados dos vínculos de Gestor (docs/produto/04 §2). A empresa
-- que já estava inativa não perde a informação na troca.
ALTER TABLE "companies"
ADD COLUMN     "deactivatedAt" TIMESTAMP(3),
ADD COLUMN     "deactivatedByUserId" TEXT;

UPDATE "companies" SET "deactivatedAt" = CURRENT_TIMESTAMP WHERE "isActive" = false;

ALTER TABLE "companies" DROP COLUMN "isActive";

-- O CNPJ passa a ser gravado só com dígitos: a máscara é apresentação, e a
-- unicidade por conta não pode depender de como alguém digitou.
UPDATE "companies" SET "document" = regexp_replace("document", '\D', '', 'g');

-- Obrigatórias no cadastro, mas as empresas que já existem nasceram sem elas.
-- O valor vazio vale só para as linhas antigas: o padrão sai logo em seguida,
-- e toda empresa nova precisa informar.
ALTER TABLE "companies"
ADD COLUMN     "contactName" TEXT NOT NULL DEFAULT '',
ADD COLUMN     "contactEmail" TEXT NOT NULL DEFAULT '',
ADD COLUMN     "zipCode" TEXT NOT NULL DEFAULT '',
ADD COLUMN     "street" TEXT NOT NULL DEFAULT '',
ADD COLUMN     "addressNumber" TEXT NOT NULL DEFAULT '',
ADD COLUMN     "district" TEXT NOT NULL DEFAULT '',
ADD COLUMN     "city" TEXT NOT NULL DEFAULT '',
ADD COLUMN     "state" TEXT NOT NULL DEFAULT '';

ALTER TABLE "companies"
ALTER COLUMN "contactName" DROP DEFAULT,
ALTER COLUMN "contactEmail" DROP DEFAULT,
ALTER COLUMN "zipCode" DROP DEFAULT,
ALTER COLUMN "street" DROP DEFAULT,
ALTER COLUMN "addressNumber" DROP DEFAULT,
ALTER COLUMN "district" DROP DEFAULT,
ALTER COLUMN "city" DROP DEFAULT,
ALTER COLUMN "state" DROP DEFAULT;

ALTER TABLE "companies"
ADD COLUMN     "stateRegistration" TEXT,
ADD COLUMN     "contactRole" TEXT,
ADD COLUMN     "contactPhone" TEXT,
ADD COLUMN     "contactMobile" TEXT,
ADD COLUMN     "complement" TEXT,
ADD COLUMN     "externalCode" TEXT,
ADD COLUMN     "notes" TEXT,
ADD COLUMN     "groupId" TEXT,
ADD COLUMN     "logoFileId" TEXT;

-- CreateTable
CREATE TABLE "company_groups" (
    "id" TEXT NOT NULL,
    "accountId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "normalizedName" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "createdByUserId" TEXT,

    CONSTRAINT "company_groups_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "file_assets" (
    "id" TEXT NOT NULL,
    "accountId" TEXT NOT NULL,
    "companyId" TEXT,
    "title" TEXT,
    "description" TEXT,
    "category" TEXT,
    "storageKey" TEXT NOT NULL,
    "mimeType" TEXT NOT NULL,
    "sizeBytes" INTEGER NOT NULL,
    "thumbnailKey" TEXT,
    "visibility" "FileVisibility" NOT NULL,
    "expiresAt" TIMESTAMP(3),
    "capturedAt" TIMESTAMP(3),
    "capturedByUserId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "createdByUserId" TEXT,

    CONSTRAINT "file_assets_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "company_groups_accountId_normalizedName_key" ON "company_groups"("accountId", "normalizedName");

-- CreateIndex
CREATE UNIQUE INDEX "file_assets_storageKey_key" ON "file_assets"("storageKey");

-- CreateIndex
CREATE INDEX "file_assets_accountId_idx" ON "file_assets"("accountId");

-- CreateIndex
CREATE INDEX "file_assets_companyId_idx" ON "file_assets"("companyId");

-- CreateIndex
CREATE UNIQUE INDEX "companies_logoFileId_key" ON "companies"("logoFileId");

-- AddForeignKey
ALTER TABLE "company_groups" ADD CONSTRAINT "company_groups_accountId_fkey" FOREIGN KEY ("accountId") REFERENCES "accounts"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "companies" ADD CONSTRAINT "companies_groupId_fkey" FOREIGN KEY ("groupId") REFERENCES "company_groups"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "companies" ADD CONSTRAINT "companies_logoFileId_fkey" FOREIGN KEY ("logoFileId") REFERENCES "file_assets"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "file_assets" ADD CONSTRAINT "file_assets_accountId_fkey" FOREIGN KEY ("accountId") REFERENCES "accounts"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "file_assets" ADD CONSTRAINT "file_assets_companyId_fkey" FOREIGN KEY ("companyId") REFERENCES "companies"("id") ON DELETE SET NULL ON UPDATE CASCADE;

