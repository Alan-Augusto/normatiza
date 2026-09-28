import {
  BadRequestException,
  ConflictException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { Prisma } from '@prisma/client';
import {
  normalizeForSearch,
  type SectorCreateResponse,
  type SectorListItem,
  type SectorMergeRequest,
  type SectorUpsertRequest,
} from '@normatiza/shared';

import { AuditAction, AuditService } from '../audit/audit.service';
import { SessionScope } from '../authorization/permission.service';
import { PrismaService } from '../prisma/prisma.service';
import { InventoryAccess } from './inventory-access.service';
import { opcional } from './text';

const COM_CONTAGEM = {
  _count: { select: { equipments: true } },
} satisfies Prisma.SectorInclude;

type SetorComContagem = Prisma.SectorGetPayload<{ include: typeof COM_CONTAGEM }>;

/**
 * Os setores da planta (docs/produto/03 §4.3). O nome é comparado
 * normalizado: "Usinagem", "usinagem " e "Usinágem" são o mesmo setor.
 */
@Injectable()
export class SectorsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly access: InventoryAccess,
    private readonly audit: AuditService,
  ) {}

  async list(actor: SessionScope, companyId: string): Promise<SectorListItem[]> {
    const { inactive } = await this.access.assertReads(actor, companyId);
    const setores = await this.prisma.sector.findMany({
      where: { companyId, accountId: actor.accountId },
      include: COM_CONTAGEM,
    });
    const responsáveis = await this.nomes(setores.map((s) => s.responsibleUserId));
    const edita = this.access.edits(actor, companyId, inactive);

    return setores
      .sort((a, b) => a.name.localeCompare(b.name, 'pt-BR'))
      .map((s) => paraLinha(s, responsáveis, edita));
  }

  /** Um nome que já existe na empresa devolve o existente, marcado como tal. */
  async create(actor: SessionScope, companyId: string, dto: SectorUpsertRequest): Promise<SectorCreateResponse> {
    await this.access.assertEdits(actor, companyId);
    const { name, normalizedName } = nomeDoSetor(dto.name);

    const existente = await this.prisma.sector.findUnique({
      where: { companyId_normalizedName: { companyId, normalizedName } },
      include: COM_CONTAGEM,
    });
    if (existente) return { ...(await this.projetar(actor, existente)), existing: true };

    const responsibleUserId = await this.responsávelVálido(actor, companyId, dto.responsibleUserId);
    let criado: SetorComContagem;
    try {
      criado = await this.prisma.sector.create({
        data: {
          accountId: actor.accountId,
          companyId,
          name,
          normalizedName,
          description: opcional(dto.description),
          responsibleUserId,
          createdByUserId: actor.userId,
        },
        include: COM_CONTAGEM,
      });
    } catch (erro) {
      // Duas pessoas criando o mesmo setor ao mesmo tempo: fica o primeiro.
      if (erro instanceof Prisma.PrismaClientKnownRequestError && erro.code === 'P2002') {
        const corrida = await this.prisma.sector.findUniqueOrThrow({
          where: { companyId_normalizedName: { companyId, normalizedName } },
          include: COM_CONTAGEM,
        });
        return { ...(await this.projetar(actor, corrida)), existing: true };
      }
      throw erro;
    }

    await this.registrar(actor, AuditAction.SECTOR_CREATED, criado.id, { name });
    return { ...(await this.projetar(actor, criado)), existing: false };
  }

  async update(
    actor: SessionScope,
    companyId: string,
    sectorId: string,
    dto: SectorUpsertRequest,
  ): Promise<SectorListItem> {
    await this.access.assertEdits(actor, companyId);
    const antes = await this.carregar(actor, companyId, sectorId);
    const { name, normalizedName } = nomeDoSetor(dto.name);

    const outro = await this.prisma.sector.findFirst({
      where: { companyId, normalizedName, id: { not: sectorId } },
      select: { name: true },
    });
    if (outro) {
      throw new ConflictException({
        statusCode: 409,
        field: 'name',
        message: `Já existe o setor "${outro.name}". Para juntar os dois, use Mesclar.`,
      });
    }

    const responsibleUserId = await this.responsávelVálido(actor, companyId, dto.responsibleUserId);
    const depois = await this.prisma.sector.update({
      where: { id: sectorId },
      data: { name, normalizedName, description: opcional(dto.description), responsibleUserId },
      include: COM_CONTAGEM,
    });

    await this.registrar(actor, AuditAction.SECTOR_UPDATED, sectorId, { name }, { name: antes.name });
    return this.projetar(actor, depois);
  }

  /** Os equipamentos do setor que sai passam para o que fica, e o que sai deixa de existir. */
  async merge(actor: SessionScope, companyId: string, sectorId: string, dto: SectorMergeRequest): Promise<void> {
    await this.access.assertEdits(actor, companyId);
    if (dto.intoSectorId === sectorId) {
      throw new BadRequestException('Escolha outro setor para receber os equipamentos.');
    }
    const origem = await this.carregar(actor, companyId, sectorId);
    const destino = await this.carregar(actor, companyId, dto.intoSectorId);

    await this.prisma.$transaction([
      this.prisma.equipment.updateMany({ where: { sectorId }, data: { sectorId: destino.id } }),
      this.prisma.sector.delete({ where: { id: sectorId } }),
    ]);

    await this.registrar(actor, AuditAction.SECTOR_MERGED, sectorId, { into: destino.name }, { name: origem.name });
  }

  async remove(actor: SessionScope, companyId: string, sectorId: string): Promise<void> {
    await this.access.assertEdits(actor, companyId);
    const setor = await this.carregar(actor, companyId, sectorId);
    if (setor._count.equipments > 0) {
      throw new ConflictException(
        `O setor "${setor.name}" tem equipamentos. Mova-os para outro setor, ou mescle os dois.`,
      );
    }

    await this.prisma.sector.delete({ where: { id: sectorId } });
    await this.registrar(actor, AuditAction.SECTOR_DELETED, sectorId, undefined, { name: setor.name });
  }

  /** O setor que um equipamento pode usar: desta empresa. */
  async daEmpresa(companyId: string, sectorId: string): Promise<boolean> {
    return (await this.prisma.sector.count({ where: { id: sectorId, companyId } })) > 0;
  }

  // ── Apoio ──────────────────────────────────────────────────────────────────

  private async carregar(actor: SessionScope, companyId: string, sectorId: string) {
    const setor = await this.prisma.sector.findFirst({
      where: { id: sectorId, companyId, accountId: actor.accountId },
      include: COM_CONTAGEM,
    });
    if (!setor) throw new NotFoundException();
    return setor;
  }

  private async projetar(actor: SessionScope, setor: SetorComContagem): Promise<SectorListItem> {
    const { inactive } = await this.access.assertReads(actor, setor.companyId);
    const responsáveis = await this.nomes([setor.responsibleUserId]);
    return paraLinha(setor, responsáveis, this.access.edits(actor, setor.companyId, inactive));
  }

  /** O responsável precisa ter vínculo com a empresa: um nome solto viraria dado que ninguém confere. */
  private async responsávelVálido(
    actor: SessionScope,
    companyId: string,
    userId: string | null | undefined,
  ): Promise<string | null> {
    if (!userId) return null;
    const vínculo = await this.prisma.membership.count({
      where: { userId, companyId, accountId: actor.accountId, isActive: true },
    });
    if (!vínculo) {
      throw new BadRequestException({
        statusCode: 400,
        field: 'responsibleUserId',
        message: 'O responsável precisa ser alguém com acesso a esta empresa.',
      });
    }
    return userId;
  }

  private async nomes(ids: (string | null)[]): Promise<Map<string, string>> {
    const únicos = [...new Set(ids.filter((id): id is string => !!id))];
    if (únicos.length === 0) return new Map();
    const pessoas = await this.prisma.user.findMany({ where: { id: { in: únicos } }, select: { id: true, name: true } });
    return new Map(pessoas.map((p) => [p.id, p.name]));
  }

  private registrar(
    actor: SessionScope,
    action: (typeof AuditAction)[keyof typeof AuditAction],
    entityId: string,
    after?: Record<string, unknown>,
    before?: Record<string, unknown>,
  ) {
    return this.audit.record({
      action,
      entityType: 'Sector',
      entityId,
      accountId: actor.accountId,
      actorUserId: actor.userId,
      ...(before ? { before } : {}),
      ...(after ? { after } : {}),
    });
  }
}

function nomeDoSetor(bruto: string): { name: string; normalizedName: string } {
  const name = (bruto ?? '').trim().replace(/\s+/g, ' ');
  const normalizedName = normalizeForSearch(name);
  if (!normalizedName) {
    throw new BadRequestException({ statusCode: 400, field: 'name', message: 'Informe o nome do setor.' });
  }
  return { name, normalizedName };
}

function paraLinha(setor: SetorComContagem, responsáveis: Map<string, string>, edita: boolean): SectorListItem {
  const responsável = setor.responsibleUserId ? responsáveis.get(setor.responsibleUserId) : undefined;
  return {
    id: setor.id,
    name: setor.name,
    ...(setor.description ? { description: setor.description } : {}),
    ...(responsável && setor.responsibleUserId ? { responsible: { id: setor.responsibleUserId, name: responsável } } : {}),
    equipmentsCount: setor._count.equipments,
    actions: { edit: edita, merge: edita, delete: edita && setor._count.equipments === 0 },
  };
}
