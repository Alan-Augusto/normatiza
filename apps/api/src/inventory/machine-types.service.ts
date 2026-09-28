import { BadRequestException, ForbiddenException, Injectable } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import {
  MACHINE_TYPE_CREATOR_ROLES,
  normalizeForSearch,
  type MachineTypeCreateRequest,
  type MachineTypeOption,
} from '@normatiza/shared';

import { AuditAction, AuditService } from '../audit/audit.service';
import { SessionScope } from '../authorization/permission.service';
import { PrismaService } from '../prisma/prisma.service';

/**
 * O catálogo de tipos de máquina (docs/produto/03 §4.2, 04 §7): o global da
 * plataforma unido ao da consultoria. Nunca o de outra conta.
 */
@Injectable()
export class MachineTypesService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly audit: AuditService,
  ) {}

  async list(actor: SessionScope, q?: string): Promise<MachineTypeOption[]> {
    const termo = q ? normalizeForSearch(q) : '';
    const tipos = await this.prisma.machineType.findMany({
      where: {
        OR: [{ accountId: null }, { accountId: actor.accountId }],
        ...(termo ? { normalizedName: { contains: termo } } : {}),
      },
      select: { id: true, name: true, accountId: true },
    });

    return tipos
      .map(paraOpção)
      .sort((a, b) => a.name.localeCompare(b.name, 'pt-BR'));
  }

  /**
   * Um nome que já existe — no global ou na conta, sem acento nem caixa —
   * devolve o existente. É o que torna seguro criar direto no formulário: quem
   * digita "prensa hidraulica" escolhe a do catálogo, e não abre uma segunda.
   */
  async create(actor: SessionScope, dto: MachineTypeCreateRequest): Promise<MachineTypeOption> {
    const papéis = actor.memberships.filter((v) => v.isActive).flatMap((v) => v.roles);
    if (!papéis.some((p) => MACHINE_TYPE_CREATOR_ROLES.includes(p))) {
      throw new ForbiddenException('O catálogo de tipos é da consultoria: escolha um tipo da lista.');
    }

    const name = dto.name.trim().replace(/\s+/g, ' ');
    const normalizedName = normalizeForSearch(name);
    if (!normalizedName) {
      throw new BadRequestException({ statusCode: 400, field: 'name', message: 'Informe o nome do tipo.' });
    }

    const existente = await this.existente(actor.accountId, normalizedName);
    if (existente) return paraOpção(existente);

    try {
      const criado = await this.prisma.machineType.create({
        data: { accountId: actor.accountId, name, normalizedName, createdByUserId: actor.userId },
        select: { id: true, name: true, accountId: true },
      });
      await this.audit.record({
        action: AuditAction.MACHINE_TYPE_CREATED,
        entityType: 'MachineType',
        entityId: criado.id,
        accountId: actor.accountId,
        actorUserId: actor.userId,
        after: { name },
      });
      return paraOpção(criado);
    } catch (erro) {
      // Duas pessoas criando o mesmo tipo ao mesmo tempo: fica o primeiro.
      if (erro instanceof Prisma.PrismaClientKnownRequestError && erro.code === 'P2002') {
        const corrida = await this.existente(actor.accountId, normalizedName);
        if (corrida) return paraOpção(corrida);
      }
      throw erro;
    }
  }

  /** O tipo que a conta pode usar: global ou dela. `null` para o de outra conta. */
  async usável(accountId: string, id: string): Promise<boolean> {
    const tipo = await this.prisma.machineType.findFirst({
      where: { id, OR: [{ accountId: null }, { accountId }] },
      select: { id: true },
    });
    return tipo !== null;
  }

  private existente(accountId: string, normalizedName: string) {
    return this.prisma.machineType.findFirst({
      where: { normalizedName, OR: [{ accountId: null }, { accountId }] },
      // O global primeiro: se a consultoria criou antes de a plataforma semear,
      // o catálogo comum ainda é o que se oferece.
      orderBy: { accountId: { sort: 'asc', nulls: 'first' } },
      select: { id: true, name: true, accountId: true },
    });
  }
}

function paraOpção(tipo: { id: string; name: string; accountId: string | null }): MachineTypeOption {
  return { id: tipo.id, name: tipo.name, global: tipo.accountId === null };
}
