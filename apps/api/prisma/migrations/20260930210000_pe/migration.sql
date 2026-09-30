-- CreateTable
CREATE TABLE "pe_assessments" (
    "id" TEXT NOT NULL,
    "accountId" TEXT NOT NULL,
    "analysisId" TEXT NOT NULL,
    "equipmentId" TEXT NOT NULL,
    "number" INTEGER NOT NULL,
    "location" TEXT,
    "answers" JSONB NOT NULL,
    "photoFileId" TEXT,
    "violatedStandardIds" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "solution" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "createdByUserId" TEXT,

    CONSTRAINT "pe_assessments_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "pe_assessments_photoFileId_key" ON "pe_assessments"("photoFileId");

-- CreateIndex
CREATE INDEX "pe_assessments_accountId_idx" ON "pe_assessments"("accountId");

-- CreateIndex
CREATE INDEX "pe_assessments_equipmentId_idx" ON "pe_assessments"("equipmentId");

-- CreateIndex
CREATE UNIQUE INDEX "pe_assessments_analysisId_number_key" ON "pe_assessments"("analysisId", "number");

-- AddForeignKey
ALTER TABLE "pe_assessments" ADD CONSTRAINT "pe_assessments_analysisId_fkey" FOREIGN KEY ("analysisId") REFERENCES "analyses"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "pe_assessments" ADD CONSTRAINT "pe_assessments_photoFileId_fkey" FOREIGN KEY ("photoFileId") REFERENCES "file_assets"("id") ON DELETE SET NULL ON UPDATE CASCADE;

