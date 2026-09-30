-- A seção "stop" do PAP é a Parada (12.4), não a parada de emergência — essa é o PE.
-- Renomeia em vez de recriar: as fotos já enviadas continuam ligadas.
ALTER TABLE "pap_assessments" RENAME COLUMN "emergencyStopPhotoFileId" TO "stopPhotoFileId";
ALTER INDEX "pap_assessments_emergencyStopPhotoFileId_key" RENAME TO "pap_assessments_stopPhotoFileId_key";
ALTER TABLE "pap_assessments" RENAME CONSTRAINT "pap_assessments_emergencyStopPhotoFileId_fkey" TO "pap_assessments_stopPhotoFileId_fkey";
