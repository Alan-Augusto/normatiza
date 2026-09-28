-- O inventário da planta: setores, catálogo de tipos de máquina e equipamentos
-- (docs/produto/03 §4.2 e §4.3, 04 §2, §3 e §7).

-- AlterTable
ALTER TABLE "companies" ADD COLUMN     "equipmentSequence" INTEGER NOT NULL DEFAULT 0;

-- AlterTable
ALTER TABLE "file_assets" ADD COLUMN     "equipmentId" TEXT;

-- CreateTable
CREATE TABLE "sectors" (
    "id" TEXT NOT NULL,
    "accountId" TEXT NOT NULL,
    "companyId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "normalizedName" TEXT NOT NULL,
    "description" TEXT,
    "responsibleUserId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "createdByUserId" TEXT,

    CONSTRAINT "sectors_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "machine_types" (
    "id" TEXT NOT NULL,
    "accountId" TEXT,
    "name" TEXT NOT NULL,
    "normalizedName" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "createdByUserId" TEXT,

    CONSTRAINT "machine_types_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "equipments" (
    "id" TEXT NOT NULL,
    "accountId" TEXT NOT NULL,
    "companyId" TEXT NOT NULL,
    "code" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "machineTypeId" TEXT,
    "model" TEXT,
    "manufacturerName" TEXT,
    "serialNumber" TEXT,
    "manufactureYear" INTEGER,
    "tag" TEXT,
    "patrimonyCode" TEXT,
    "sectorId" TEXT,
    "mainPhotoFileId" TEXT,
    "deactivatedAt" TIMESTAMP(3),
    "deactivatedByUserId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "createdByUserId" TEXT,

    CONSTRAINT "equipments_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "sectors_accountId_idx" ON "sectors"("accountId");

-- CreateIndex
CREATE UNIQUE INDEX "sectors_companyId_normalizedName_key" ON "sectors"("companyId", "normalizedName");

-- CreateIndex
CREATE UNIQUE INDEX "machine_types_accountId_normalizedName_key" ON "machine_types"("accountId", "normalizedName");

-- CreateIndex
CREATE UNIQUE INDEX "equipments_mainPhotoFileId_key" ON "equipments"("mainPhotoFileId");

-- CreateIndex
CREATE INDEX "equipments_accountId_idx" ON "equipments"("accountId");

-- CreateIndex
CREATE INDEX "equipments_sectorId_idx" ON "equipments"("sectorId");

-- CreateIndex
CREATE UNIQUE INDEX "equipments_companyId_code_key" ON "equipments"("companyId", "code");

-- CreateIndex
CREATE UNIQUE INDEX "equipments_companyId_tag_key" ON "equipments"("companyId", "tag");

-- CreateIndex
CREATE INDEX "file_assets_equipmentId_idx" ON "file_assets"("equipmentId");

-- AddForeignKey
ALTER TABLE "file_assets" ADD CONSTRAINT "file_assets_equipmentId_fkey" FOREIGN KEY ("equipmentId") REFERENCES "equipments"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "sectors" ADD CONSTRAINT "sectors_companyId_fkey" FOREIGN KEY ("companyId") REFERENCES "companies"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "machine_types" ADD CONSTRAINT "machine_types_accountId_fkey" FOREIGN KEY ("accountId") REFERENCES "accounts"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "equipments" ADD CONSTRAINT "equipments_companyId_fkey" FOREIGN KEY ("companyId") REFERENCES "companies"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "equipments" ADD CONSTRAINT "equipments_machineTypeId_fkey" FOREIGN KEY ("machineTypeId") REFERENCES "machine_types"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "equipments" ADD CONSTRAINT "equipments_sectorId_fkey" FOREIGN KEY ("sectorId") REFERENCES "sectors"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "equipments" ADD CONSTRAINT "equipments_mainPhotoFileId_fkey" FOREIGN KEY ("mainPhotoFileId") REFERENCES "file_assets"("id") ON DELETE SET NULL ON UPDATE CASCADE;


-- Tipo global é o de `accountId` nulo, e o Postgres trata nulos como distintos:
-- sem este índice, o índice composto acima deixaria dois "Prensa hidráulica"
-- globais conviverem.
CREATE UNIQUE INDEX "machine_types_global_normalizedName_key" ON "machine_types"("normalizedName") WHERE "accountId" IS NULL;

-- O catálogo global inicial: as máquinas mais comuns da base legada e da NR-12.
-- `normalizedName` é o `normalizeForSearch` de @normatiza/shared (minúsculas,
-- sem acento, espaço simples). A consultoria acrescenta os dela pela tela.
INSERT INTO "machine_types" ("id", "name", "normalizedName") VALUES
  ('mt-esteira-transportadora', 'Esteira transportadora', 'esteira transportadora'),
  ('mt-rosca-transportadora', 'Rosca transportadora', 'rosca transportadora'),
  ('mt-elevador-de-canecas', 'Elevador de canecas', 'elevador de canecas'),
  ('mt-transportador-de-correntes', 'Transportador de correntes', 'transportador de correntes'),
  ('mt-bomba-centrifuga', 'Bomba centrífuga', 'bomba centrifuga'),
  ('mt-compressor-de-ar', 'Compressor de ar', 'compressor de ar'),
  ('mt-compressor-de-refrigeracao', 'Compressor de refrigeração', 'compressor de refrigeracao'),
  ('mt-exaustor', 'Exaustor', 'exaustor'),
  ('mt-ventilador-industrial', 'Ventilador industrial', 'ventilador industrial'),
  ('mt-prensa-excentrica', 'Prensa excêntrica', 'prensa excentrica'),
  ('mt-prensa-hidraulica', 'Prensa hidráulica', 'prensa hidraulica'),
  ('mt-prensa-dobradeira', 'Prensa dobradeira', 'prensa dobradeira'),
  ('mt-guilhotina', 'Guilhotina', 'guilhotina'),
  ('mt-balancim', 'Balancim', 'balancim'),
  ('mt-calandra', 'Calandra', 'calandra'),
  ('mt-torno', 'Torno', 'torno'),
  ('mt-fresadora', 'Fresadora', 'fresadora'),
  ('mt-centro-de-usinagem', 'Centro de usinagem', 'centro de usinagem'),
  ('mt-retifica', 'Retífica', 'retifica'),
  ('mt-furadeira-de-bancada', 'Furadeira de bancada', 'furadeira de bancada'),
  ('mt-serra-de-fita', 'Serra de fita', 'serra de fita'),
  ('mt-serra-circular', 'Serra circular', 'serra circular'),
  ('mt-esmeril', 'Esmeril', 'esmeril'),
  ('mt-injetora-de-plastico', 'Injetora de plástico', 'injetora de plastico'),
  ('mt-extrusora', 'Extrusora', 'extrusora'),
  ('mt-misturador', 'Misturador', 'misturador'),
  ('mt-moinho', 'Moinho', 'moinho'),
  ('mt-peletizadora', 'Peletizadora', 'peletizadora'),
  ('mt-ensacadeira', 'Ensacadeira', 'ensacadeira'),
  ('mt-empacotadora', 'Empacotadora', 'empacotadora'),
  ('mt-seladora', 'Seladora', 'seladora'),
  ('mt-paletizadora', 'Paletizadora', 'paletizadora'),
  ('mt-robo-industrial', 'Robô industrial', 'robo industrial'),
  ('mt-ponte-rolante', 'Ponte rolante', 'ponte rolante'),
  ('mt-talha-eletrica', 'Talha elétrica', 'talha eletrica'),
  ('mt-incubadora', 'Incubadora', 'incubadora'),
  ('mt-nascedouro', 'Nascedouro', 'nascedouro'),
  ('mt-desossadeira', 'Desossadeira', 'desossadeira'),
  ('mt-serra-de-carcaca', 'Serra de carcaça', 'serra de carcaca'),
  ('mt-moedor-de-carne', 'Moedor de carne', 'moedor de carne'),
  ('mt-cutter', 'Cutter', 'cutter'),
  ('mt-embutidora', 'Embutidora', 'embutidora'),
  ('mt-tanque-de-escaldagem', 'Tanque de escaldagem', 'tanque de escaldagem'),
  ('mt-depenadeira', 'Depenadeira', 'depenadeira'),
  ('mt-maquina-de-lavar-caixas', 'Máquina de lavar caixas', 'maquina de lavar caixas');
