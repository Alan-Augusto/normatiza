import {
  BadRequestException,
  ConflictException,
  ForbiddenException,
  Injectable,
  InternalServerErrorException,
  NotFoundException,
} from '@nestjs/common';
import { Prisma } from '@prisma/client';
import {
  ANALYSIS_EDITOR_ROLES,
  RECOGNITION_VIEWS,
  SAFETY_MANAGEMENT_QUESTIONS,
  parseEquipmentCode,
  type AnalysisActions,
  type AnalysisCreateRequest,
  type AnalysisDetail,
  type AnalysisListItem,
  type AnalysisSheetUpdate,
  type PersonRef,
  type RecognitionPhoto,
  type RecognitionView,
  type RiskLevel,
  type SafetyManagement,
} from '@normatiza/shared';

import { AuditAction, AuditActionValue, AuditService } from '../audit/audit.service';
import { AuthService } from '../auth/auth.service';
import { PermissionService, SessionScope } from '../authorization/permission.service';
import { CompanyWriteGuard } from '../companies/company-write-guard.service';
import { InventoryAccess } from '../inventory/inventory-access.service';
import { PrismaService } from '../prisma/prisma.service';
import { FilesService } from '../storage/files.service';
import { FOTOS_DO_PAP, papDto } from './pap-dto';
import { pontoDto } from './risk-point-dto';

const ARQUIVO = { select: { id: true, storageKey: true, thumbnailKey: true } } as const;

const COMPLETA = {
  frontPhoto: ARQUIVO,
  leftSidePhoto: ARQUIVO,
  rightSidePhoto: ARQUIVO,
  rearPhoto: ARQUIVO,
  riskPoints: { include: { hazardPhoto: ARQUIVO }, orderBy: { number: 'asc' } },
  paps: { include: FOTOS_DO_PAP, orderBy: { number: 'asc' } },
} satisfies Prisma.AnalysisInclude;

/** O que a lista precisa dos pontos: contar e achar o pior. */
const RESUMO_DOS_PONTOS = { riskPoints: { select: { hrnResult: true, hrnLevel: true } } } satisfies Prisma.AnalysisInclude;

type Pontos = Array<{ hrnResult: number | null; hrnLevel: RiskLevel | null }>;

type AnáliseCompleta = Prisma.AnalysisGetPayload<{ include: typeof COMPLETA }>;

/** A coluna de cada vista, e o nome da relação que a carrega. */
const VISTA = {
  front: { coluna: 'frontPhotoFileId', relação: 'frontPhoto' },
  leftSide: { coluna: 'leftSidePhotoFileId', relação: 'leftSidePhoto' },
  rightSide: { coluna: 'rightSidePhotoFileId', relação: 'rightSidePhoto' },
  rear: { coluna: 'rearPhotoFileId', relação: 'rearPhoto' },
} as const satisfies Record<RecognitionView, { coluna: keyof AnáliseCompleta; relação: keyof AnáliseCompleta }>;

interface Máquina {
  id: string;
  companyId: string;
  name: string;
  deactivatedAt: Date | null;
}

/**
 * A análise de risco (docs/produto/03 §5.2, 04 §4). Mora no equipamento e é
 * endereçada pelo número dela ali: `EQ-0042 · Análise 2`.
 *
 * O rascunho é da consultoria: o cliente não o vê, nem sabe que existe — a
 * análise aparece para ele quando é concluída. Para quem não vê, rascunho é 404.
 */
@Injectable()
export class AnalysesService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly inventory: InventoryAccess,
    private readonly permissions: PermissionService,
    private readonly writeGuard: CompanyWriteGuard,
    private readonly auth: AuthService,
    private readonly files: FilesService,
    private readonly audit: AuditService,
  ) {}

  // ── Leitura ────────────────────────────────────────────────────────────────

  /** A revisão vigente de cada análise, da mais nova para a mais antiga. */
  async list(actor: SessionScope, companyId: string, code: string): Promise<AnalysisListItem[]> {
    const { inactive } = await this.inventory.assertReads(actor, companyId);
    const máquina = await this.máquina(actor, companyId, code);
    const consultoria = this.éConsultoria(actor, companyId);

    const todas = await this.prisma.analysis.findMany({
      where: { equipmentId: máquina.id, ...(consultoria ? {} : { status: 'CONCLUDED' }) },
      orderBy: [{ number: 'desc' }, { revision: 'desc' }],
      include: RESUMO_DOS_PONTOS,
    });
    const vigentes = todas.filter((a, i) => i === 0 || todas[i - 1].number !== a.number);

    const pessoas = await this.pessoas(vigentes);
    const edita = consultoria && !inactive && !máquina.deactivatedAt;
    return vigentes.map((a) => this.linha(a, pessoas, edita));
  }

  async get(actor: SessionScope, companyId: string, code: string, number: number): Promise<AnalysisDetail> {
    const { inactive } = await this.inventory.assertReads(actor, companyId);
    const máquina = await this.máquina(actor, companyId, code);
    const análise = await this.carregar(actor, companyId, máquina, number);
    return this.detalhe(análise, this.éConsultoria(actor, companyId) && !inactive && !máquina.deactivatedAt);
  }

  /**
   * Quem pode ser o técnico de campo desta máquina: a consultoria alocada na
   * empresa, com vínculo ativo. É a lista que o seletor da etapa 1 mostra — a
   * Equipe da Empresa não serve, porque mostra a consultoria só como contexto.
   */
  async fieldTechnicians(actor: SessionScope, companyId: string, code: string): Promise<PersonRef[]> {
    await this.assertEdita(actor, companyId);
    await this.máquina(actor, companyId, code);

    const vínculos = await this.prisma.membership.findMany({
      where: {
        accountId: actor.accountId,
        companyId,
        isActive: true,
        roles: { hasSome: [...ANALYSIS_EDITOR_ROLES] },
        user: { status: 'ACTIVE' },
      },
      select: { user: { select: { id: true, name: true } } },
    });
    return vínculos.map((v) => v.user).sort((a, b) => a.name.localeCompare(b.name, 'pt-BR'));
  }

  // ── Escrita ────────────────────────────────────────────────────────────────

  /**
   * Abre o rascunho. Com o `id` do aparelho, reenviar é seguro: a análise que já
   * nasceu com aquele id volta, em vez de uma segunda (D10).
   */
  async create(
    actor: SessionScope,
    companyId: string,
    code: string,
    dto: AnalysisCreateRequest,
  ): Promise<{ analysis: AnalysisDetail; created: boolean }> {
    await this.assertEdita(actor, companyId);
    const máquina = await this.máquina(actor, companyId, code);
    assertAtiva(máquina);

    if (dto.id) {
      const mesma = await this.prisma.analysis.findUnique({ where: { id: dto.id }, include: COMPLETA });
      if (mesma) {
        if (mesma.equipmentId !== máquina.id) throw new ConflictException('Esse id já é de outra análise.');
        return { analysis: await this.detalhe(mesma, true), created: false };
      }
    }

    const aberta = await this.prisma.analysis.findFirst({
      where: { equipmentId: máquina.id, status: 'DRAFT' },
      select: { number: true },
    });
    if (aberta) throw rascunhoAberto(aberta.number);

    const tabela = await this.prisma.hrnTableVersion.findFirst({
      where: { effectiveTo: null },
      orderBy: { effectiveFrom: 'desc' },
      select: { id: true },
    });
    // A migração semeia a tabela: faltar é banco quebrado, não erro de quem pediu.
    if (!tabela) throw new InternalServerErrorException('Nenhuma tabela HRN vigente');

    // O próximo depois do maior que existe (D7): rascunho descartado libera o número.
    const { _max } = await this.prisma.analysis.aggregate({ where: { equipmentId: máquina.id }, _max: { number: true } });
    const number = (_max.number ?? 0) + 1;

    let criada: AnáliseCompleta;
    try {
      criada = await this.prisma.analysis.create({
        data: {
          ...(dto.id ? { id: dto.id } : {}),
          accountId: actor.accountId,
          companyId,
          equipmentId: máquina.id,
          number,
          hrnTableVersionId: tabela.id,
          fieldTechnicianUserId: actor.userId,
          createdByUserId: actor.userId,
        },
        include: COMPLETA,
      });
    } catch (erro) {
      // Dois cliques ao mesmo tempo: a checagem acima perde, o índice parcial não.
      if (erro instanceof Prisma.PrismaClientKnownRequestError && erro.code === 'P2002') {
        const outra = await this.prisma.analysis.findFirst({ where: { equipmentId: máquina.id, status: 'DRAFT' } });
        throw rascunhoAberto(outra?.number ?? number);
      }
      throw erro;
    }

    await this.registrar(actor, AuditAction.ANALYSIS_CREATED, criada, { number, equipmentId: máquina.id });
    return { analysis: await this.detalhe(criada, true), created: true };
  }

  /** A etapa 1 inteira: o que não vier é limpo. Nada é obrigatório no rascunho. */
  async updateSheet(
    actor: SessionScope,
    companyId: string,
    code: string,
    number: number,
    dto: AnalysisSheetUpdate,
  ): Promise<AnalysisDetail> {
    const { análise } = await this.rascunho(actor, companyId, code, number);

    const técnico = dto.fieldTechnicianUserId ?? null;
    if (técnico && técnico !== análise.fieldTechnicianUserId) await this.assertTécnico(actor, companyId, técnico);

    const dados = {
      fieldTechnicianUserId: técnico,
      cycleTimeSec: dto.times?.cycleTimeSec ?? null,
      activationTimeSec: dto.times?.activationTimeSec ?? null,
      emergencyStopTimeSec: dto.times?.emergencyStopTimeSec ?? null,
      shiftRegime: dto.shiftRegime ?? null,
      ...Object.fromEntries(SAFETY_MANAGEMENT_QUESTIONS.map((q) => [q.key, dto.safetyManagement?.[q.key] ?? null])),
    };

    const depois = await this.prisma.analysis.update({ where: { id: análise.id }, data: dados, include: COMPLETA });
    await this.registrar(actor, AuditAction.ANALYSIS_SHEET_UPDATED, depois, dados, retrato(análise));
    return this.detalhe(depois, true);
  }

  /**
   * Trocar a foto de um rascunho apaga a anterior: nenhum laudo aponta para
   * ela, diferente da foto do equipamento, que se preserva.
   */
  async setPhoto(
    actor: SessionScope,
    companyId: string,
    code: string,
    number: number,
    view: string,
    bytes: Buffer,
  ): Promise<RecognitionPhoto> {
    const vista = vistaDe(view);
    const { análise, máquina } = await this.rascunho(actor, companyId, code, number);

    const arquivo = await this.files.uploadAnalysisPhoto({
      accountId: actor.accountId,
      companyId,
      equipmentId: máquina.id,
      analysisId: análise.id,
      actorUserId: actor.userId,
      folder: vista,
      category: `ANALYSIS_PHOTO_${vista.replace(/[A-Z]/g, (l) => `_${l}`).toUpperCase()}`,
      bytes,
    });
    const anterior = análise[VISTA[vista].relação];
    await this.prisma.analysis.update({ where: { id: análise.id }, data: { [VISTA[vista].coluna]: arquivo.id } });
    if (anterior) await this.files.remove(anterior);

    await this.registrar(actor, AuditAction.ANALYSIS_PHOTO_CHANGED, análise, { view: vista, fileId: arquivo.id });
    return this.foto(arquivo);
  }

  async removePhoto(actor: SessionScope, companyId: string, code: string, number: number, view: string): Promise<void> {
    const vista = vistaDe(view);
    const { análise } = await this.rascunho(actor, companyId, code, number);
    const anterior = análise[VISTA[vista].relação];
    if (!anterior) return;

    await this.prisma.analysis.update({ where: { id: análise.id }, data: { [VISTA[vista].coluna]: null } });
    await this.files.remove(anterior);
    await this.registrar(actor, AuditAction.ANALYSIS_PHOTO_CHANGED, análise, { view: vista, fileId: null });
  }

  /** Só rascunho: apaga ele e as fotos dele. A auditoria guarda o que ele tinha. */
  async discard(actor: SessionScope, companyId: string, code: string, number: number): Promise<void> {
    const { análise } = await this.rascunho(actor, companyId, code, number);
    const arquivos = await this.prisma.fileAsset.findMany({ where: { analysisId: análise.id }, ...ARQUIVO });

    for (const arquivo of arquivos) await this.files.remove(arquivo);
    await this.prisma.analysis.delete({ where: { id: análise.id } });

    await this.registrar(actor, AuditAction.ANALYSIS_DISCARDED, análise, undefined, retrato(análise));
  }

  // ── Apoio ──────────────────────────────────────────────────────────────────

  /** Os papéis que mexem na análise são os da consultoria (01 §7). */
  private éConsultoria(actor: SessionScope, companyId: string): boolean {
    return this.permissions.effectiveRoles(actor, companyId).some((p) => ANALYSIS_EDITOR_ROLES.includes(p));
  }

  /**
   * Quem lê a empresa e não é da consultoria recebe 404 no rascunho (acima) e
   * 403 na escrita: ele vê que a análise existe quando ela é concluída, só não
   * a altera.
   */
  private async assertEdita(actor: SessionScope, companyId: string): Promise<void> {
    await this.inventory.assertReads(actor, companyId);
    if (!this.éConsultoria(actor, companyId)) {
      throw new ForbiddenException('A análise de risco é feita pela consultoria. A empresa a vê quando ela é concluída.');
    }
    await this.writeGuard.assertWritable(actor.accountId, [companyId]);
  }

  /** O rascunho, pronto para ser escrito — ou a recusa que explica por que não. Os pontos de risco usam também. */
  async rascunho(actor: SessionScope, companyId: string, code: string, number: number) {
    await this.assertEdita(actor, companyId);
    const máquina = await this.máquina(actor, companyId, code);
    assertAtiva(máquina);
    const análise = await this.carregar(actor, companyId, máquina, number);
    if (análise.status !== 'DRAFT') {
      throw new ConflictException('Análise concluída é congelada. A correção gera uma nova revisão.');
    }
    return { análise, máquina };
  }

  private async máquina(actor: SessionScope, companyId: string, code: string): Promise<Máquina> {
    const canônico = parseEquipmentCode(code);
    if (!canônico) throw new NotFoundException();
    const máquina = await this.prisma.equipment.findFirst({
      where: { companyId, accountId: actor.accountId, code: canônico },
      select: { id: true, companyId: true, name: true, deactivatedAt: true },
    });
    if (!máquina) throw new NotFoundException();
    return máquina;
  }

  /** A revisão vigente daquele número, se quem pergunta pode vê-la. */
  private async carregar(actor: SessionScope, companyId: string, máquina: Máquina, number: number): Promise<AnáliseCompleta> {
    const análise = await this.prisma.analysis.findFirst({
      where: { equipmentId: máquina.id, number },
      orderBy: { revision: 'desc' },
      include: COMPLETA,
    });
    if (!análise) throw new NotFoundException();
    if (análise.status === 'DRAFT' && !this.éConsultoria(actor, companyId)) throw new NotFoundException();
    return análise;
  }

  /** O técnico de campo é alguém da consultoria alocado nesta empresa. */
  private async assertTécnico(actor: SessionScope, companyId: string, userId: string): Promise<void> {
    const pessoa = await this.prisma.user.findFirst({
      where: { id: userId, accountId: actor.accountId, status: 'ACTIVE' },
      select: { id: true },
    });
    const escopo = pessoa ? await this.auth.buildScope(pessoa.id) : null;
    if (!escopo || !this.éConsultoria(escopo, companyId)) {
      throw new BadRequestException({
        statusCode: 400,
        field: 'fieldTechnicianUserId',
        message: 'O técnico de campo precisa ser da consultoria alocada nesta empresa.',
      });
    }
  }

  private async pessoas(análises: Array<{ fieldTechnicianUserId: string | null; responsibleEngineerUserId: string | null }>) {
    const ids = [...new Set(análises.flatMap((a) => [a.fieldTechnicianUserId, a.responsibleEngineerUserId]).filter((id): id is string => !!id))];
    const achadas = ids.length === 0 ? [] : await this.prisma.user.findMany({ where: { id: { in: ids } }, select: { id: true, name: true } });
    return new Map<string, PersonRef>(achadas.map((p) => [p.id, p]));
  }

  private linha(
    a: Prisma.AnalysisGetPayload<object> & { riskPoints: Pontos },
    pessoas: Map<string, PersonRef>,
    edita: boolean,
  ): AnalysisListItem {
    const pior = a.riskPoints.reduce<{ result: number; level: RiskLevel } | null>(
      (maior, p) => (p.hrnResult !== null && p.hrnLevel !== null && (!maior || p.hrnResult > maior.result) ? { result: p.hrnResult, level: p.hrnLevel } : maior),
      null,
    );
    const técnico = a.fieldTechnicianUserId ? pessoas.get(a.fieldTechnicianUserId) : undefined;
    const engenheiro = a.responsibleEngineerUserId ? pessoas.get(a.responsibleEngineerUserId) : undefined;
    return {
      id: a.id,
      number: a.number,
      revision: a.revision,
      status: a.status,
      startedAt: a.startedAt.toISOString(),
      ...(a.concludedAt ? { concludedAt: a.concludedAt.toISOString() } : {}),
      ...(técnico ? { fieldTechnician: técnico } : {}),
      ...(engenheiro ? { responsibleEngineer: engenheiro } : {}),
      riskPointsCount: a.riskPoints.length,
      ...(pior ? { worstHrn: pior } : {}),
      actions: ações(a, edita),
    };
  }

  private async detalhe(a: AnáliseCompleta, edita: boolean): Promise<AnalysisDetail> {
    const pessoas = await this.pessoas([a]);
    const photos: AnalysisDetail['photos'] = {};
    for (const vista of RECOGNITION_VIEWS) {
      const arquivo = a[VISTA[vista].relação];
      if (arquivo) photos[vista] = await this.foto(arquivo);
    }
    const tempos = { cycleTimeSec: a.cycleTimeSec, activationTimeSec: a.activationTimeSec, emergencyStopTimeSec: a.emergencyStopTimeSec };

    return {
      ...this.linha(a, pessoas, edita),
      norm: a.norm,
      hrnTableVersionId: a.hrnTableVersionId,
      ...(a.artNumber ? { artNumber: a.artNumber } : {}),
      sheet: {
        times: Object.fromEntries(Object.entries(tempos).filter(([, v]) => v !== null)),
        ...(a.shiftRegime ? { shiftRegime: a.shiftRegime } : {}),
        safetyManagement: Object.fromEntries(SAFETY_MANAGEMENT_QUESTIONS.map((q) => [q.key, a[q.key]])) as SafetyManagement,
      },
      photos,
      riskPoints: await Promise.all(a.riskPoints.map((p) => pontoDto(this.files, p))),
      paps: await Promise.all(a.paps.map((p) => papDto(this.files, p))),
    };
  }

  private async foto(arquivo: { storageKey: string; thumbnailKey: string | null }): Promise<RecognitionPhoto> {
    return {
      url: (await this.files.readUrl(arquivo)) ?? '',
      thumbnailUrl: (await this.files.readThumbnailUrl(arquivo)) ?? '',
    };
  }

  private registrar(
    actor: SessionScope,
    action: AuditActionValue,
    análise: { id: string; companyId: string; equipmentId: string },
    after?: Record<string, unknown>,
    before?: Record<string, unknown>,
  ) {
    return this.audit.record({
      action,
      entityType: 'Analysis',
      entityId: análise.id,
      accountId: actor.accountId,
      actorUserId: actor.userId,
      ...(before ? { before } : {}),
      after: { ...(after ?? {}), companyId: análise.companyId, equipmentId: análise.equipmentId },
    });
  }
}

function ações(a: { status: string }, edita: boolean): AnalysisActions {
  const rascunho = a.status === 'DRAFT';
  return { edit: edita && rascunho, discard: edita && rascunho };
}

function assertAtiva(máquina: Máquina): void {
  if (máquina.deactivatedAt) {
    throw new ConflictException(`"${máquina.name}" está desativado e em modo leitura. Reative para analisar.`);
  }
}

function vistaDe(view: string): RecognitionView {
  if (!(RECOGNITION_VIEWS as readonly string[]).includes(view)) throw new NotFoundException();
  return view as RecognitionView;
}

function rascunhoAberto(number: number) {
  return new ConflictException({
    statusCode: 409,
    number,
    message: `A Análise ${number} desta máquina ainda é rascunho. Conclua ou descarte antes de abrir outra.`,
  });
}

function retrato(a: AnáliseCompleta): Record<string, unknown> {
  return {
    number: a.number,
    fieldTechnicianUserId: a.fieldTechnicianUserId,
    cycleTimeSec: a.cycleTimeSec,
    activationTimeSec: a.activationTimeSec,
    emergencyStopTimeSec: a.emergencyStopTimeSec,
    shiftRegime: a.shiftRegime,
    ...Object.fromEntries(SAFETY_MANAGEMENT_QUESTIONS.map((q) => [q.key, a[q.key]])),
    photos: Object.fromEntries(RECOGNITION_VIEWS.map((v) => [v, a[VISTA[v].coluna]])),
  };
}
