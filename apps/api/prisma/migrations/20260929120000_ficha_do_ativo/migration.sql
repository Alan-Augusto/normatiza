-- A ficha do ativo no equipamento: características da máquina, não medidas da
-- vistoria (docs/produto/03 §4.2, 04 §3). Colunas opcionais: só acrescenta.

-- CreateEnum
CREATE TYPE "EnergySource" AS ENUM ('ELECTRIC', 'PNEUMATIC', 'HYDRAULIC', 'MECHANICAL', 'RADIOACTIVE');

-- AlterTable
ALTER TABLE "equipments" ADD COLUMN     "commonInterventions" TEXT,
ADD COLUMN     "controlStations" INTEGER,
ADD COLUMN     "depthMm" INTEGER,
ADD COLUMN     "energySources" "EnergySource"[] DEFAULT ARRAY[]::"EnergySource"[],
ADD COLUMN     "exposedOperators" INTEGER,
ADD COLUMN     "heightMm" INTEGER,
ADD COLUMN     "manufacturerAddress" TEXT,
ADD COLUMN     "manufacturerCity" TEXT,
ADD COLUMN     "manufacturerDocument" TEXT,
ADD COLUMN     "manufacturerRegistry" TEXT,
ADD COLUMN     "manufacturerZipCode" TEXT,
ADD COLUMN     "otherInfo" TEXT,
ADD COLUMN     "powerKw" DOUBLE PRECISION,
ADD COLUMN     "processDescription" TEXT,
ADD COLUMN     "productiveCapacity" TEXT,
ADD COLUMN     "purpose" TEXT,
ADD COLUMN     "weightKg" DOUBLE PRECISION,
ADD COLUMN     "widthMm" INTEGER;

