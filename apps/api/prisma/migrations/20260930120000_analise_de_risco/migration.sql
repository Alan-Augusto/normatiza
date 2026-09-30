-- A análise de risco, primeira parte: abrir a análise e a ficha técnica
-- (docs/produto/03 §5.2, 04 §4; docs/planos/analise-de-risco.md).

-- CreateEnum
CREATE TYPE "AnalysisStatus" AS ENUM ('DRAFT', 'CONCLUDED');

-- AlterTable
ALTER TABLE "file_assets" ADD COLUMN     "analysisId" TEXT;

-- CreateTable
CREATE TABLE "analyses" (
    "id" TEXT NOT NULL,
    "accountId" TEXT NOT NULL,
    "companyId" TEXT NOT NULL,
    "equipmentId" TEXT NOT NULL,
    "number" INTEGER NOT NULL,
    "revision" INTEGER NOT NULL DEFAULT 1,
    "supersedesAnalysisId" TEXT,
    "norm" TEXT NOT NULL DEFAULT 'NR-12',
    "status" "AnalysisStatus" NOT NULL DEFAULT 'DRAFT',
    "startedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "concludedAt" TIMESTAMP(3),
    "frozenAt" TIMESTAMP(3),
    "fieldTechnicianUserId" TEXT,
    "responsibleEngineerUserId" TEXT,
    "artNumber" TEXT,
    "hrnTableVersionId" TEXT NOT NULL,
    "cycleTimeSec" DOUBLE PRECISION,
    "activationTimeSec" DOUBLE PRECISION,
    "emergencyStopTimeSec" DOUBLE PRECISION,
    "shiftRegime" TEXT,
    "maintenancePlannedByQualifiedProfessional" BOOLEAN,
    "maintenanceRecorded" BOOLEAN,
    "maintenanceRecordsAvailable" BOOLEAN,
    "hasInstructionManual" BOOLEAN,
    "hasWorkAndSafetyProcedures" BOOLEAN,
    "workersTrained" BOOLEAN,
    "frontPhotoFileId" TEXT,
    "leftSidePhotoFileId" TEXT,
    "rightSidePhotoFileId" TEXT,
    "rearPhotoFileId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "createdByUserId" TEXT,

    CONSTRAINT "analyses_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "analyses_frontPhotoFileId_key" ON "analyses"("frontPhotoFileId");

-- CreateIndex
CREATE UNIQUE INDEX "analyses_leftSidePhotoFileId_key" ON "analyses"("leftSidePhotoFileId");

-- CreateIndex
CREATE UNIQUE INDEX "analyses_rightSidePhotoFileId_key" ON "analyses"("rightSidePhotoFileId");

-- CreateIndex
CREATE UNIQUE INDEX "analyses_rearPhotoFileId_key" ON "analyses"("rearPhotoFileId");

-- CreateIndex
CREATE INDEX "analyses_accountId_idx" ON "analyses"("accountId");

-- CreateIndex
CREATE INDEX "analyses_companyId_idx" ON "analyses"("companyId");

-- CreateIndex
CREATE UNIQUE INDEX "analyses_equipmentId_number_revision_key" ON "analyses"("equipmentId", "number", "revision");

-- CreateIndex
CREATE INDEX "file_assets_analysisId_idx" ON "file_assets"("analysisId");

-- AddForeignKey
ALTER TABLE "file_assets" ADD CONSTRAINT "file_assets_analysisId_fkey" FOREIGN KEY ("analysisId") REFERENCES "analyses"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "analyses" ADD CONSTRAINT "analyses_equipmentId_fkey" FOREIGN KEY ("equipmentId") REFERENCES "equipments"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "analyses" ADD CONSTRAINT "analyses_hrnTableVersionId_fkey" FOREIGN KEY ("hrnTableVersionId") REFERENCES "hrn_table_versions"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "analyses" ADD CONSTRAINT "analyses_frontPhotoFileId_fkey" FOREIGN KEY ("frontPhotoFileId") REFERENCES "file_assets"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "analyses" ADD CONSTRAINT "analyses_leftSidePhotoFileId_fkey" FOREIGN KEY ("leftSidePhotoFileId") REFERENCES "file_assets"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "analyses" ADD CONSTRAINT "analyses_rightSidePhotoFileId_fkey" FOREIGN KEY ("rightSidePhotoFileId") REFERENCES "file_assets"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "analyses" ADD CONSTRAINT "analyses_rearPhotoFileId_fkey" FOREIGN KEY ("rearPhotoFileId") REFERENCES "file_assets"("id") ON DELETE SET NULL ON UPDATE CASCADE;


-- Um rascunho por equipamento (D6). Parcial: análises concluídas são muitas.
CREATE UNIQUE INDEX "analyses_one_draft_per_equipment" ON "analyses"("equipmentId") WHERE "status" = 'DRAFT';
