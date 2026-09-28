import { ForbiddenException, Injectable, NotFoundException } from '@nestjs/common';
import { EQUIPMENT_EDITOR_ROLES, canEditInventory } from '@normatiza/shared';

import { PermissionService, SessionScope } from '../authorization/permission.service';
import { CompanyWriteGuard } from '../companies/company-write-guard.service';
import { PrismaService } from '../prisma/prisma.service';

/**
 * A alçada do inventário, num lugar só — equipamentos e setores respondem à
 * mesma pergunta (docs/produto/03 §4.2 e §4.3).
 *
 * Fora do escopo, e para o Executor, a empresa **não existe** (404): o escopo
 * dele são as tarefas, e confirmar que há um inventário ali já é dizer algo.
 * Dentro do escopo sem alçada — a Diretora — é 403: ela vê, só não mexe.
 */
@Injectable()
export class InventoryAccess {
  constructor(
    private readonly prisma: PrismaService,
    private readonly permissions: PermissionService,
    private readonly writeGuard: CompanyWriteGuard,
  ) {}

  /** Quem pode ver o inventário desta empresa. Devolve se a empresa está inativa. */
  async assertReads(actor: SessionScope, companyId: string): Promise<{ inactive: boolean }> {
    if (!this.permissions.canReadCompanyData(actor, companyId)) throw new NotFoundException();

    const empresa = await this.prisma.company.findFirst({
      where: { id: companyId, accountId: actor.accountId },
      select: { deactivatedAt: true },
    });
    if (!empresa) throw new NotFoundException();

    return { inactive: empresa.deactivatedAt !== null };
  }

  /** Quem pode mexer no inventário desta empresa — e a empresa aceita escrita. */
  async assertEdits(actor: SessionScope, companyId: string): Promise<void> {
    await this.assertReads(actor, companyId);
    if (!this.permissions.effectiveRoles(actor, companyId).some((p) => EQUIPMENT_EDITOR_ROLES.includes(p))) {
      throw new ForbiddenException('Quem só acompanha a empresa vê o inventário, mas não o altera.');
    }
    await this.writeGuard.assertWritable(actor.accountId, [companyId]);
  }

  /** O que as `actions` por linha perguntam: sem lançar, para a lista inteira de uma vez. */
  edits(actor: SessionScope, companyId: string, companyInactive: boolean): boolean {
    return canEditInventory(this.permissions.effectiveRoles(actor, companyId), companyInactive);
  }
}
