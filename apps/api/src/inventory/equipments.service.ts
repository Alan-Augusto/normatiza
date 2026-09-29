import {
  BadRequestException,
  ConflictException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { Prisma } from '@prisma/client';
import {
  formatEquipmentCode,
  isValidCnpj,
  normalizeForSearch,
  onlyDigits,
  parseEquipmentCode,
  type EquipmentActions,
  type EquipmentDetail,
  type EquipmentDuplicates,
  type EquipmentListItem,
  type EquipmentListQuery,
  type EquipmentSheet,
  type EquipmentUpsertRequest,
} from '@normatiza/shared';

import { AuditAction, AuditService } from '../audit/audit.service';
import { SessionScope } from '../authorization/permission.service';
import { PrismaService } from '../prisma/prisma.service';
import { FilesService } from '../storage/files.service';
import { InventoryAccess } from './inventory-access.service';
import { MachineTypesService } from './machine-types.service';
import { SectorsService } from './sectors.service';
import { opcional } from './text';

const COMPLETO = {
  sector: { select: { id: true, name: true } },
  machineType: { select: { id: true, name: true, accountId: true } },
  mainPhoto: { select: { id: true, storageKey: true, thumbnailKey: true } },
} satisfies Prisma.EquipmentInclude;

type EquipamentoCompleto = Prisma.EquipmentGetPayload<{ include: typeof COMPLETO }>;

/** O ano mais antigo que se aceita: máquina de antes disso é peça de museu, ou erro de digitação. */
const PRIMEIRO_ANO = 1900;

/**
 * O inventário da planta (docs/produto/03 §4.2, 04 §3). O equipamento é
 * endereçado pelo **código** (`EQ-0042`) dentro da empresa: imutável e nunca
 * reaproveitado, ele serve de chave sem que a URL carregue um id.
 */
@Injectable()
export class EquipmentsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly access: InventoryAccess,
    private readonly sectors: SectorsService,
    private readonly machineTypes: MachineTypesService,
    private readonly files: FilesService,
    private readonly audit: AuditService,
  ) {}

  // ── Leitura ────────────────────────────────────────────────────────────────

  /**
   * Busca e filtro em memória sobre o inventário da empresa, com o mesmo
   * `normalizeForSearch` das empresas: são centenas de máquinas por planta, não
   * milhões, e o que conta como "igual" é decidido num lugar só.
   */
  async list(actor: SessionScope, companyId: string, query: EquipmentListQuery = {}): Promise<EquipmentListItem[]> {
    const { inactive } = await this.access.assertReads(actor, companyId);
    const status = query.status;

    const máquinas = await this.prisma.equipment.findMany({
      where: {
        companyId,
        accountId: actor.accountId,
        ...(query.sectorId ? { sectorId: query.sectorId } : {}),
        ...(status === 'ALL' ? {} : status === 'INACTIVE' ? { deactivatedAt: { not: null } } : { deactivatedAt: null }),
      },
      include: COMPLETO,
      orderBy: { code: 'asc' },
    });

    const edita = this.access.edits(actor, companyId, inactive);
    const filtradas = query.q ? máquinas.filter((m) => corresponde(m, query.q!)) : máquinas;
    return Promise.all(filtradas.map((m) => this.linha(m, edita)));
  }

  async get(actor: SessionScope, companyId: string, code: string): Promise<EquipmentDetail> {
    const { inactive } = await this.access.assertReads(actor, companyId);
    const máquina = await this.carregar(actor, companyId, code);
    return this.detalhe(máquina, this.access.edits(actor, companyId, inactive));
  }

  /** Quem já usa a série ou o patrimônio: aviso para o formulário, não recusa (D4). */
  async duplicates(
    actor: SessionScope,
    companyId: string,
    query: { serialNumber?: string; patrimonyCode?: string; except?: string },
  ): Promise<EquipmentDuplicates> {
    await this.access.assertReads(actor, companyId);
    const exceto = query.except ? parseEquipmentCode(query.except) : null;

    const quem = async (campo: 'serialNumber' | 'patrimonyCode', valor: string | undefined) => {
      const aparado = opcional(valor);
      if (!aparado) return [];
      const achados = await this.prisma.equipment.findMany({
        where: {
          companyId,
          accountId: actor.accountId,
          [campo]: { equals: aparado, mode: 'insensitive' },
          ...(exceto ? { code: { not: exceto } } : {}),
        },
        select: { code: true, name: true },
        orderBy: { code: 'asc' },
      });
      return achados;
    };

    return {
      serialNumber: await quem('serialNumber', query.serialNumber),
      patrimonyCode: await quem('patrimonyCode', query.patrimonyCode),
    };
  }

  // ── Escrita ────────────────────────────────────────────────────────────────

  async create(actor: SessionScope, companyId: string, dto: EquipmentUpsertRequest): Promise<EquipmentDetail> {
    await this.access.assertEdits(actor, companyId);
    const dados = await this.dadosDoCadastro(actor, companyId, dto);
    if (dados.tag) await this.assertTagLivre(companyId, dados.tag);

    const criada = await this.gravar(() =>
      this.prisma.$transaction(async (tx) => {
        // O contador sobe na mesma transação: duas criações simultâneas nunca
        // leem o mesmo número, e um código que existiu nunca volta.
        const { equipmentSequence } = await tx.company.update({
          where: { id: companyId },
          data: { equipmentSequence: { increment: 1 } },
          select: { equipmentSequence: true },
        });
        return tx.equipment.create({
          data: {
            accountId: actor.accountId,
            companyId,
            code: formatEquipmentCode(equipmentSequence),
            createdByUserId: actor.userId,
            ...dados,
          },
          include: COMPLETO,
        });
      }),
    );

    await this.registrar(actor, AuditAction.EQUIPMENT_CREATED, criada, { ...dados, code: criada.code });
    return this.detalhe(criada, true);
  }

  async update(
    actor: SessionScope,
    companyId: string,
    code: string,
    dto: EquipmentUpsertRequest,
  ): Promise<EquipmentDetail> {
    await this.access.assertEdits(actor, companyId);
    const antes = await this.carregar(actor, companyId, code);
    assertAtivo(antes);

    const dados = await this.dadosDoCadastro(actor, companyId, dto);
    if (dados.tag) await this.assertTagLivre(companyId, dados.tag, antes.id);

    const depois = await this.gravar(() =>
      this.prisma.equipment.update({ where: { id: antes.id }, data: dados, include: COMPLETO }),
    );

    await this.registrar(actor, AuditAction.EQUIPMENT_UPDATED, depois, dados, retrato(antes));
    return this.detalhe(depois, true);
  }

  /** Fora do inventário, em modo leitura. Histórico, código e análises ficam. */
  async deactivate(actor: SessionScope, companyId: string, code: string): Promise<void> {
    await this.access.assertEdits(actor, companyId);
    const máquina = await this.carregar(actor, companyId, code);
    if (máquina.deactivatedAt) return;

    await this.prisma.equipment.update({
      where: { id: máquina.id },
      data: { deactivatedAt: new Date(), deactivatedByUserId: actor.userId },
    });
    await this.registrar(actor, AuditAction.EQUIPMENT_DEACTIVATED, máquina);
  }

  async reactivate(actor: SessionScope, companyId: string, code: string): Promise<void> {
    await this.access.assertEdits(actor, companyId);
    const máquina = await this.carregar(actor, companyId, code);
    if (!máquina.deactivatedAt) return;

    await this.prisma.equipment.update({
      where: { id: máquina.id },
      data: { deactivatedAt: null, deactivatedByUserId: null },
    });
    await this.registrar(actor, AuditAction.EQUIPMENT_REACTIVATED, máquina);
  }

  /**
   * Exclusão de verdade — só do equipamento que nunca teve análise: o
   * cadastro feito errado não tem prova a preservar (docs/produto/03 §4.2).
   * Enquanto a análise não existe no sistema, todo equipamento se enquadra; a
   * checagem nasce com ela. As fotos saem junto, registro e bytes.
   */
  async remove(actor: SessionScope, companyId: string, code: string): Promise<void> {
    await this.access.assertEdits(actor, companyId);
    const máquina = await this.carregar(actor, companyId, code);
    const arquivos = await this.prisma.fileAsset.findMany({
      where: { equipmentId: máquina.id },
      select: { id: true, storageKey: true, thumbnailKey: true },
    });

    await this.prisma.$transaction([
      this.prisma.equipment.update({ where: { id: máquina.id }, data: { mainPhotoFileId: null } }),
      this.prisma.equipment.delete({ where: { id: máquina.id } }),
    ]);
    for (const arquivo of arquivos) await this.files.remove(arquivo);

    await this.registrar(actor, AuditAction.EQUIPMENT_DELETED, máquina, undefined, retrato(máquina));
  }

  /** A foto antiga não é apagada: o laudo emitido aponta para a da época, como o logo. */
  async setPhoto(
    actor: SessionScope,
    companyId: string,
    code: string,
    bytes: Buffer,
  ): Promise<{ photoUrl: string | null; thumbnailUrl: string | null }> {
    await this.access.assertEdits(actor, companyId);
    const máquina = await this.carregar(actor, companyId, code);
    assertAtivo(máquina);

    const arquivo = await this.files.uploadEquipmentPhoto({
      accountId: actor.accountId,
      companyId,
      equipmentId: máquina.id,
      actorUserId: actor.userId,
      bytes,
    });
    await this.prisma.equipment.update({ where: { id: máquina.id }, data: { mainPhotoFileId: arquivo.id } });
    await this.registrar(
      actor,
      AuditAction.EQUIPMENT_PHOTO_CHANGED,
      máquina,
      { mainPhotoFileId: arquivo.id },
      { mainPhotoFileId: máquina.mainPhotoFileId },
    );

    return { photoUrl: await this.files.readUrl(arquivo), thumbnailUrl: await this.files.readThumbnailUrl(arquivo) };
  }

  async removePhoto(actor: SessionScope, companyId: string, code: string): Promise<void> {
    await this.access.assertEdits(actor, companyId);
    const máquina = await this.carregar(actor, companyId, code);
    assertAtivo(máquina);
    if (!máquina.mainPhotoFileId) return;

    await this.prisma.equipment.update({ where: { id: máquina.id }, data: { mainPhotoFileId: null } });
    await this.registrar(
      actor,
      AuditAction.EQUIPMENT_PHOTO_CHANGED,
      máquina,
      { mainPhotoFileId: null },
      { mainPhotoFileId: máquina.mainPhotoFileId },
    );
  }

  // ── Apoio ──────────────────────────────────────────────────────────────────

  private async carregar(actor: SessionScope, companyId: string, code: string): Promise<EquipamentoCompleto> {
    const canônico = parseEquipmentCode(code);
    if (!canônico) throw new NotFoundException();

    const máquina = await this.prisma.equipment.findFirst({
      where: { companyId, accountId: actor.accountId, code: canônico },
      include: COMPLETO,
    });
    if (!máquina) throw new NotFoundException();
    return máquina;
  }

  /** O formato foi conferido no DTO; aqui se normaliza, e se confere o que depende do banco. */
  private async dadosDoCadastro(actor: SessionScope, companyId: string, dto: EquipmentUpsertRequest) {
    const name = (dto.name ?? '').trim().replace(/\s+/g, ' ');
    if (!name) {
      throw new BadRequestException({ statusCode: 400, field: 'name', message: 'Informe o nome do equipamento.' });
    }

    const ano = dto.manufactureYear ?? null;
    const último = new Date().getFullYear() + 1;
    if (ano !== null && (!Number.isInteger(ano) || ano < PRIMEIRO_ANO || ano > último)) {
      throw new BadRequestException({
        statusCode: 400,
        field: 'manufactureYear',
        message: `O ano de fabricação precisa estar entre ${PRIMEIRO_ANO} e ${último}.`,
      });
    }

    const sectorId = dto.sectorId || null;
    if (sectorId && !(await this.sectors.daEmpresa(companyId, sectorId))) {
      throw new BadRequestException({ statusCode: 400, field: 'sectorId', message: 'Esse setor não é desta empresa.' });
    }

    const machineTypeId = dto.machineTypeId || null;
    if (machineTypeId && !(await this.machineTypes.usável(actor.accountId, machineTypeId))) {
      throw new BadRequestException({ statusCode: 400, field: 'machineTypeId', message: 'Tipo de máquina desconhecido.' });
    }

    // A TAG é código de placa: comparada e guardada sem espaço e em maiúsculas,
    // para que "pr-01" e "PR-01" não convivam como duas máquinas.
    const tag = opcional(dto.tag)?.toUpperCase() ?? null;

    return {
      name,
      machineTypeId,
      model: opcional(dto.model),
      manufacturerName: opcional(dto.manufacturerName),
      serialNumber: opcional(dto.serialNumber),
      manufactureYear: ano,
      tag,
      patrimonyCode: opcional(dto.patrimonyCode),
      sectorId,
      ...colunasDaFicha(dto.sheet ?? {}),
    };
  }

  private async assertTagLivre(companyId: string, tag: string, exceto?: string): Promise<void> {
    const outra = await this.prisma.equipment.findFirst({
      where: { companyId, tag, ...(exceto ? { id: { not: exceto } } : {}) },
      select: { code: true, name: true },
    });
    if (outra) throw tagRepetida(tag, outra);
  }

  /** A checagem acima perde para duas gravações simultâneas; o índice do banco não perde. */
  private async gravar<T>(operação: () => Promise<T>): Promise<T> {
    try {
      return await operação();
    } catch (erro) {
      if (erro instanceof Prisma.PrismaClientKnownRequestError && erro.code === 'P2002') {
        if (String(erro.meta?.target ?? '').includes('tag')) {
          throw new ConflictException({ statusCode: 409, field: 'tag', message: 'Outra máquina desta empresa já usa essa TAG.' });
        }
      }
      throw erro;
    }
  }

  private async linha(m: EquipamentoCompleto, edita: boolean): Promise<EquipmentListItem> {
    const thumbnailUrl = m.mainPhoto ? await this.files.readThumbnailUrl(m.mainPhoto) : null;
    return {
      code: m.code,
      name: m.name,
      ...(m.machineType ? { machineType: { id: m.machineType.id, name: m.machineType.name, global: m.machineType.accountId === null } } : {}),
      ...(m.model ? { model: m.model } : {}),
      ...(m.manufacturerName ? { manufacturerName: m.manufacturerName } : {}),
      ...(m.serialNumber ? { serialNumber: m.serialNumber } : {}),
      ...(m.tag ? { tag: m.tag } : {}),
      ...(m.patrimonyCode ? { patrimonyCode: m.patrimonyCode } : {}),
      ...(m.sector ? { sector: m.sector } : {}),
      ...(thumbnailUrl ? { thumbnailUrl } : {}),
      status: m.deactivatedAt ? 'INACTIVE' : 'ACTIVE',
      // Sem análise no sistema ainda: nada a medir. Os campos de risco ficam
      // ausentes, e a tela mostra "—" (docs/produto/03 §4.2).
      complianceStatus: 'NOT_ASSESSED',
      openPointsCount: 0,
      actions: ações(m, edita),
    };
  }

  private async detalhe(m: EquipamentoCompleto, edita: boolean): Promise<EquipmentDetail> {
    const photoUrl = m.mainPhoto ? await this.files.readUrl(m.mainPhoto) : null;
    return {
      ...(await this.linha(m, edita)),
      id: m.id,
      ...(m.manufactureYear ? { manufactureYear: m.manufactureYear } : {}),
      sheet: fichaDe(m),
      ...(photoUrl ? { photoUrl } : {}),
      createdAt: m.createdAt.toISOString(),
    };
  }

  private registrar(
    actor: SessionScope,
    action: (typeof AuditAction)[keyof typeof AuditAction],
    máquina: { id: string; companyId: string },
    after?: Record<string, unknown>,
    before?: Record<string, unknown>,
  ) {
    return this.audit.record({
      action,
      entityType: 'Equipment',
      entityId: máquina.id,
      accountId: actor.accountId,
      actorUserId: actor.userId,
      ...(before ? { before } : {}),
      ...(after ? { after: { ...after, companyId: máquina.companyId } } : { after: { companyId: máquina.companyId } }),
    });
  }
}

/**
 * A ficha que chega vira colunas. Como a identidade, a edição é **inteira**: o
 * que não vier, ou vier vazio, é limpo. O CNPJ do fabricante é conferido aqui
 * para responder no campo, que o DTO não sabe nomear com o caminho inteiro.
 */
function colunasDaFicha(ficha: Partial<EquipmentSheet>) {
  const dimensões = ficha.dimensions ?? {};
  const fabricante = ficha.manufacturer ?? {};

  const cnpj = opcional(fabricante.document);
  const documento = cnpj ? onlyDigits(cnpj) : null;
  if (documento && !isValidCnpj(documento)) {
    throw new BadRequestException({
      statusCode: 400,
      field: 'sheet.manufacturer.document',
      message: 'O CNPJ do fabricante não é válido. Confira os dígitos, ou deixe em branco.',
    });
  }
  const cep = opcional(fabricante.zipCode);

  return {
    purpose: opcional(ficha.purpose),
    productiveCapacity: opcional(ficha.productiveCapacity),
    powerKw: ficha.powerKw ?? null,
    controlStations: ficha.controlStations ?? null,
    exposedOperators: ficha.exposedOperators ?? null,
    // Sem repetição: marcar "Elétrica" duas vezes não é ter duas fontes.
    energySources: [...new Set(ficha.energySources ?? [])],
    processDescription: opcional(ficha.processDescription),
    commonInterventions: opcional(ficha.commonInterventions),
    otherInfo: opcional(ficha.otherInfo),
    heightMm: dimensões.heightMm ?? null,
    widthMm: dimensões.widthMm ?? null,
    depthMm: dimensões.depthMm ?? null,
    weightKg: dimensões.weightKg ?? null,
    manufacturerDocument: documento,
    manufacturerRegistry: opcional(fabricante.registry),
    manufacturerAddress: opcional(fabricante.address),
    manufacturerCity: opcional(fabricante.city),
    manufacturerZipCode: cep ? onlyDigits(cep) : null,
  };
}

/** As colunas voltam como a ficha: só o que foi preenchido, e as listas sempre presentes. */
function fichaDe(m: EquipamentoCompleto): EquipmentSheet {
  const presente = <T extends Record<string, unknown>>(obj: T) =>
    Object.fromEntries(Object.entries(obj).filter(([, v]) => v !== null && v !== undefined)) as {
      [K in keyof T]?: NonNullable<T[K]>;
    };

  return {
    ...presente({
      purpose: m.purpose,
      productiveCapacity: m.productiveCapacity,
      powerKw: m.powerKw,
      controlStations: m.controlStations,
      exposedOperators: m.exposedOperators,
      processDescription: m.processDescription,
      commonInterventions: m.commonInterventions,
      otherInfo: m.otherInfo,
    }),
    energySources: m.energySources,
    dimensions: presente({ heightMm: m.heightMm, widthMm: m.widthMm, depthMm: m.depthMm, weightKg: m.weightKg }),
    manufacturer: presente({
      document: m.manufacturerDocument,
      registry: m.manufacturerRegistry,
      address: m.manufacturerAddress,
      city: m.manufacturerCity,
      zipCode: m.manufacturerZipCode,
    }),
  };
}

function ações(m: { deactivatedAt: Date | null }, edita: boolean): EquipmentActions {
  const ativo = !m.deactivatedAt;
  return { edit: edita && ativo, deactivate: edita && ativo, reactivate: edita && !ativo, delete: edita };
}

function assertAtivo(m: { deactivatedAt: Date | null; name: string }): void {
  if (m.deactivatedAt) {
    throw new ConflictException(`"${m.name}" está desativado e em modo leitura. Reative para alterar.`);
  }
}

function tagRepetida(tag: string, outra: { code: string; name: string }) {
  return new ConflictException({
    statusCode: 409,
    field: 'tag',
    message: `A TAG ${tag} já é de "${outra.name}" (${outra.code}), nesta empresa.`,
  });
}

function retrato(m: EquipamentoCompleto): Record<string, unknown> {
  return {
    name: m.name,
    machineTypeId: m.machineTypeId,
    model: m.model,
    manufacturerName: m.manufacturerName,
    serialNumber: m.serialNumber,
    manufactureYear: m.manufactureYear,
    tag: m.tag,
    patrimonyCode: m.patrimonyCode,
    sectorId: m.sectorId,
  };
}

/** A busca olha a identidade inteira e o código, sem acento nem caixa. */
function corresponde(m: EquipamentoCompleto, q: string): boolean {
  const termo = normalizeForSearch(q);
  const campos = [m.code, m.name, m.tag, m.serialNumber, m.patrimonyCode, m.model, m.manufacturerName, m.machineType?.name, m.sector?.name];
  return campos.some((c) => c && normalizeForSearch(c).includes(termo));
}
