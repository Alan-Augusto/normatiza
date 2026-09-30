-- CreateTable
CREATE TABLE "pap_assessments" (
    "id" TEXT NOT NULL,
    "accountId" TEXT NOT NULL,
    "analysisId" TEXT NOT NULL,
    "equipmentId" TEXT NOT NULL,
    "number" INTEGER NOT NULL,
    "location" TEXT,
    "answers" JSONB NOT NULL,
    "activationPhotoFileId" TEXT,
    "resetPhotoFileId" TEXT,
    "emergencyStopPhotoFileId" TEXT,
    "violatedStandardIds" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "solution" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "createdByUserId" TEXT,

    CONSTRAINT "pap_assessments_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "pap_assessments_activationPhotoFileId_key" ON "pap_assessments"("activationPhotoFileId");

-- CreateIndex
CREATE UNIQUE INDEX "pap_assessments_resetPhotoFileId_key" ON "pap_assessments"("resetPhotoFileId");

-- CreateIndex
CREATE UNIQUE INDEX "pap_assessments_emergencyStopPhotoFileId_key" ON "pap_assessments"("emergencyStopPhotoFileId");

-- CreateIndex
CREATE INDEX "pap_assessments_accountId_idx" ON "pap_assessments"("accountId");

-- CreateIndex
CREATE INDEX "pap_assessments_equipmentId_idx" ON "pap_assessments"("equipmentId");

-- CreateIndex
CREATE UNIQUE INDEX "pap_assessments_analysisId_number_key" ON "pap_assessments"("analysisId", "number");

-- AddForeignKey
ALTER TABLE "pap_assessments" ADD CONSTRAINT "pap_assessments_analysisId_fkey" FOREIGN KEY ("analysisId") REFERENCES "analyses"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "pap_assessments" ADD CONSTRAINT "pap_assessments_activationPhotoFileId_fkey" FOREIGN KEY ("activationPhotoFileId") REFERENCES "file_assets"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "pap_assessments" ADD CONSTRAINT "pap_assessments_resetPhotoFileId_fkey" FOREIGN KEY ("resetPhotoFileId") REFERENCES "file_assets"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "pap_assessments" ADD CONSTRAINT "pap_assessments_emergencyStopPhotoFileId_fkey" FOREIGN KEY ("emergencyStopPhotoFileId") REFERENCES "file_assets"("id") ON DELETE SET NULL ON UPDATE CASCADE;

