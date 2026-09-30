-- Os pontos de risco da análise, com o HRN (docs/produto/03 §5.2, 04 §4;
-- docs/planos/analise-de-risco.md D11–D13).

-- CreateEnum
CREATE TYPE "RiskLevel" AS ENUM ('ACCEPTABLE', 'VERY_LOW', 'LOW', 'SIGNIFICANT', 'HIGH', 'VERY_HIGH', 'EXTREME', 'UNACCEPTABLE');

-- CreateTable
CREATE TABLE "risk_points" (
    "id" TEXT NOT NULL,
    "accountId" TEXT NOT NULL,
    "analysisId" TEXT NOT NULL,
    "equipmentId" TEXT NOT NULL,
    "number" INTEGER NOT NULL,
    "location" TEXT,
    "hazardOriginIds" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "hazardConsequenceIds" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "existingProtectionIds" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "violatedStandardIds" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "hrnFe" DOUBLE PRECISION,
    "hrnPe" DOUBLE PRECISION,
    "hrnMpl" DOUBLE PRECISION,
    "hrnNp" DOUBLE PRECISION,
    "hrnResult" DOUBLE PRECISION,
    "hrnLevel" "RiskLevel",
    "safetySeverity" INTEGER,
    "safetyFrequency" INTEGER,
    "safetyPossibility" INTEGER,
    "safetyCategory" INTEGER,
    "suggestedSolution" TEXT,
    "hazardPhotoFileId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "createdByUserId" TEXT,

    CONSTRAINT "risk_points_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "risk_points_hazardPhotoFileId_key" ON "risk_points"("hazardPhotoFileId");

-- CreateIndex
CREATE INDEX "risk_points_accountId_idx" ON "risk_points"("accountId");

-- CreateIndex
CREATE INDEX "risk_points_equipmentId_idx" ON "risk_points"("equipmentId");

-- CreateIndex
CREATE UNIQUE INDEX "risk_points_analysisId_number_key" ON "risk_points"("analysisId", "number");

-- AddForeignKey
ALTER TABLE "risk_points" ADD CONSTRAINT "risk_points_analysisId_fkey" FOREIGN KEY ("analysisId") REFERENCES "analyses"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "risk_points" ADD CONSTRAINT "risk_points_hazardPhotoFileId_fkey" FOREIGN KEY ("hazardPhotoFileId") REFERENCES "file_assets"("id") ON DELETE SET NULL ON UPDATE CASCADE;

