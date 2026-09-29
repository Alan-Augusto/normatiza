-- Catálogos da análise: normas, perigos, proteções, a tabela HRN e o registro
-- de origem dos dados migrados (docs/produto/04 §7, docs/migracao §1 e §7).
-- Os catálogos em si chegam pelo importador (catalogos:importar); só a tabela
-- HRN nasce aqui, porque existe em todo ambiente sem depender de script.

-- CreateTable
CREATE TABLE "standard_sections" (
    "id" TEXT NOT NULL,
    "norm" TEXT NOT NULL DEFAULT 'NR-12',
    "name" TEXT NOT NULL,
    "order" INTEGER NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "standard_sections_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "standards" (
    "id" TEXT NOT NULL,
    "norm" TEXT NOT NULL DEFAULT 'NR-12',
    "sectionId" TEXT NOT NULL,
    "itemCode" TEXT NOT NULL,
    "text" TEXT NOT NULL,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "standards_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "hazard_types" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "order" INTEGER NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "hazard_types_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "hazard_origins" (
    "id" TEXT NOT NULL,
    "hazardTypeId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "hazard_origins_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "hazard_consequences" (
    "id" TEXT NOT NULL,
    "hazardTypeId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "hazard_consequences_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "protection_types" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "order" INTEGER NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "protection_types_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "protections" (
    "id" TEXT NOT NULL,
    "protectionTypeId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "protections_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "hrn_table_versions" (
    "id" TEXT NOT NULL,
    "label" TEXT NOT NULL,
    "effectiveFrom" TIMESTAMP(3) NOT NULL,
    "effectiveTo" TIMESTAMP(3),
    "factors" JSONB NOT NULL,
    "levels" JSONB NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "hrn_table_versions_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "legacy_refs" (
    "entity" TEXT NOT NULL,
    "legacyId" INTEGER NOT NULL,
    "newId" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "legacy_refs_pkey" PRIMARY KEY ("entity","legacyId")
);

-- CreateIndex
CREATE INDEX "standards_sectionId_idx" ON "standards"("sectionId");

-- CreateIndex
CREATE INDEX "hazard_origins_hazardTypeId_idx" ON "hazard_origins"("hazardTypeId");

-- CreateIndex
CREATE INDEX "hazard_consequences_hazardTypeId_idx" ON "hazard_consequences"("hazardTypeId");

-- CreateIndex
CREATE INDEX "protections_protectionTypeId_idx" ON "protections"("protectionTypeId");

-- CreateIndex
CREATE INDEX "legacy_refs_entity_newId_idx" ON "legacy_refs"("entity", "newId");

-- AddForeignKey
ALTER TABLE "standards" ADD CONSTRAINT "standards_sectionId_fkey" FOREIGN KEY ("sectionId") REFERENCES "standard_sections"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "hazard_origins" ADD CONSTRAINT "hazard_origins_hazardTypeId_fkey" FOREIGN KEY ("hazardTypeId") REFERENCES "hazard_types"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "hazard_consequences" ADD CONSTRAINT "hazard_consequences_hazardTypeId_fkey" FOREIGN KEY ("hazardTypeId") REFERENCES "hazard_types"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "protections" ADD CONSTRAINT "protections_protectionTypeId_fkey" FOREIGN KEY ("protectionTypeId") REFERENCES "protection_types"("id") ON DELETE RESTRICT ON UPDATE CASCADE;


-- A tabela HRN inicial, idêntica ao legado (docs/produto/04 §7). É a mesma de
-- HRN_TABLE_LEGACY, em @normatiza/shared; `hrn.spec.ts` confere que não divergem.
INSERT INTO "hrn_table_versions" ("id", "label", "effectiveFrom", "factors", "levels") VALUES
  ('hrn-legado-v1', 'Tabela do sistema anterior', '2000-01-01T00:00:00.000Z', '{"fe":[{"weight":0.5,"label":"Anualmente"},{"weight":1,"label":"Mensalmente"},{"weight":1.5,"label":"Semanalmente"},{"weight":2.5,"label":"Diariamente"},{"weight":4,"label":"Em termos de hora"},{"weight":5,"label":"Constantemente"}],"pe":[{"weight":0.03,"label":"Quase impossível","helpText":"Ponto totalmente protegido. Sem chance de falha física normal."},{"weight":1,"label":"Altamente improvável","helpText":"Ponto protegido, sem sensores, mas posicionado fora da área operacional ativa."},{"weight":1.5,"label":"Improvável","helpText":"Situação improvável, mas concebível (ex: barreira mecânica sem sensor)."},{"weight":2,"label":"Possível","helpText":"Situação possível, mas não usual (ex: proteção móvel NR-12 sem chave de segurança)."},{"weight":5,"label":"Alguma chance","helpText":"O perigo pode ser acessado de forma voluntária (aberturas médias/grandes)."},{"weight":8,"label":"Provável","helpText":"O operador realiza atividades muito próximo ao ponto, sem barreira física."},{"weight":10,"label":"Muito provável","helpText":"Operador interage diretamente com a zona ou sistema de acionamento manual aberto."},{"weight":15,"label":"Certo","helpText":"Operador trabalha em contato físico direto contínuo com a parte móvel/perigosa."}],"mpl":[{"weight":0.1,"label":"Arranhão / contusão leve"},{"weight":0.5,"label":"Dilaceração / doenças moderadas"},{"weight":2,"label":"Fratura / enfermidade leve"},{"weight":4,"label":"Fratura / enfermidade grave"},{"weight":6,"label":"Perda de um membro / olho"},{"weight":10,"label":"Perda de dois membros / olhos"},{"weight":15,"label":"Fatalidade"}],"np":[{"weight":1,"label":"1-2 pessoas"},{"weight":2,"label":"3-7 pessoas"},{"weight":4,"label":"8-15 pessoas"},{"weight":8,"label":"16-50 pessoas"},{"weight":12,"label":"Mais que 50 pessoas"}]}'::jsonb, '[{"level":"ACCEPTABLE","label":"Risco Aceitável","minExclusive":null,"maxInclusive":1},{"level":"VERY_LOW","label":"Risco Muito Baixo","minExclusive":1,"maxInclusive":5},{"level":"LOW","label":"Risco Baixo","minExclusive":5,"maxInclusive":10},{"level":"SIGNIFICANT","label":"Risco Significante","minExclusive":10,"maxInclusive":50},{"level":"HIGH","label":"Risco Alto","minExclusive":50,"maxInclusive":100},{"level":"VERY_HIGH","label":"Risco Muito Alto","minExclusive":100,"maxInclusive":500},{"level":"EXTREME","label":"Risco Extremo","minExclusive":500,"maxInclusive":1000},{"level":"UNACCEPTABLE","label":"Risco Inaceitável","minExclusive":1000,"maxInclusive":null}]'::jsonb);
