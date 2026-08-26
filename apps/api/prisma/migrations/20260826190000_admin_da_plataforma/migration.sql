-- AlterEnum
--
-- `SYSTEM_ADMIN` sai de `Role`: o Admin do Sistema é a plataforma, tem escopo
-- global e passa a viver em `platform_admins`. Nenhum dado usa o valor — não
-- havia caminho para criá-lo (`CAN_INVITE` não o oferecia a ninguém).
--
-- O índice parcial da invariante de vínculo único referencia `"Role"[]`, então
-- ele impede o `DROP TYPE`. Cai antes e volta depois, idêntico.
BEGIN;

DROP INDEX IF EXISTS "memberships_company_scoped_role_unico";

CREATE TYPE "Role_new" AS ENUM ('LEAD_ENGINEER', 'CONSULTANT_ENGINEER', 'TECHNICIAN', 'MANAGER', 'CLIENT_ENGINEER', 'DIRECTOR', 'EXECUTOR');
ALTER TABLE "memberships" ALTER COLUMN "roles" TYPE "Role_new"[] USING ("roles"::text::"Role_new"[]);
ALTER TABLE "invitations" ALTER COLUMN "roles" TYPE "Role_new"[] USING ("roles"::text::"Role_new"[]);
ALTER TYPE "Role" RENAME TO "Role_old";
ALTER TYPE "Role_new" RENAME TO "Role";
DROP TYPE "Role_old";

CREATE UNIQUE INDEX "memberships_company_scoped_role_unico"
  ON "memberships" ("userId")
  WHERE "isActive"
    AND "roles" && ARRAY['MANAGER', 'CLIENT_ENGINEER', 'DIRECTOR']::"Role"[];

COMMIT;

-- CreateTable
CREATE TABLE "platform_admins" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "grantedByUserId" TEXT,
    "grantedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "revokedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "platform_admins_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "platform_admins_userId_key" ON "platform_admins"("userId");

-- AddForeignKey
ALTER TABLE "platform_admins" ADD CONSTRAINT "platform_admins_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
