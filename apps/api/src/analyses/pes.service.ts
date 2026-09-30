import { BadRequestException, ConflictException, Injectable, NotFoundException } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import type { PeDto, PeUpsert, RecognitionPhoto } from '@normatiza/shared';

import { AuditAction, AuditService } from '../audit/audit.service';
import { SessionScope } from '../authorization/permission.service';
import { PrismaService } from '../prisma/prisma.service';
import { FilesService } from '../storage/files.service';
import { AnalysesService } from './analyses.service';
import { FOTO_DO_PE, PeComFoto, peDto, respostasDoPe } from './pe-dto';
import { foto } from './risk-point-dto';

/**
 * Os PE da análise (docs/produto/03 §5.2, 04 §4): um por dispositivo de parada
 * de emergência. Gravado inteiro pelo id do aparelho, como o PAP (D11). Só em
 * rascunho.
 */
@Injectable()
export class PesService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly analyses: AnalysesService,
    private readonly files: FilesService,
    private readonly audit: AuditService,
  ) {}

  async upsert(actor: SessionScope, companyId: string, code: string, number: number, peId: string, dto: PeUpsert): Promise<PeDto> {
    const { análise, máquina } = await this.analyses.rascunho(actor, companyId, code, number);

    const existente = await this.prisma.peAssessment.findUnique({ where: { id: peId } });
    if (existente && existente.analysisId !== análise.id) throw new ConflictException('Esse id já é de outro PE.');

    const dados = {
      location: aparado(dto.location),
      answers: respostasDoPe(dto.answers) as unknown as Prisma.InputJsonValue,
      violatedStandardIds: await this.normasConferidas(dto.violatedStandardIds),
      solution: aparado(dto.solution),
    };

    let gravado: PeComFoto;
    if (existente) {
      gravado = await this.prisma.peAssessment.update({ where: { id: peId }, data: dados, include: FOTO_DO_PE });
    } else {
      gravado = await this.criar(() =>
        this.prisma.$transaction(async (tx) => {
          const { _max } = await tx.peAssessment.aggregate({ where: { analysisId: análise.id }, _max: { number: true } });
          return tx.peAssessment.create({
            data: {
              id: peId,
              accountId: actor.accountId,
              analysisId: análise.id,
              equipmentId: máquina.id,
              number: (_max.number ?? 0) + 1,
              createdByUserId: actor.userId,
              ...dados,
            },
            include: FOTO_DO_PE,
          });
        }),
      );
    }

    await this.registrar(actor, AuditAction.ANALYSIS_PE_SAVED, análise, { peId, number: gravado.number, ...dados });
    return peDto(this.files, gravado);
  }

  /** Exclui do rascunho e renumera os seguintes, como os pontos de risco. */
  async remove(actor: SessionScope, companyId: string, code: string, number: number, peId: string): Promise<void> {
    const { análise } = await this.analyses.rascunho(actor, companyId, code, number);
    const pe = await this.pe(análise.id, peId);

    await this.prisma.$transaction(async (tx) => {
      await tx.peAssessment.delete({ where: { id: pe.id } });
      const seguintes = await tx.peAssessment.findMany({
        where: { analysisId: análise.id, number: { gt: pe.number } },
        orderBy: { number: 'asc' },
        select: { id: true, number: true },
      });
      for (const s of seguintes) await tx.peAssessment.update({ where: { id: s.id }, data: { number: s.number - 1 } });
    });
    if (pe.photo) await this.files.remove(pe.photo);

    await this.registrar(actor, AuditAction.ANALYSIS_PE_DELETED, análise, { peId, number: pe.number });
  }

  /** A foto do dispositivo. Trocar apaga a anterior: é rascunho. */
  async setPhoto(actor: SessionScope, companyId: string, code: string, number: number, peId: string, bytes: Buffer): Promise<RecognitionPhoto> {
    const { análise, máquina } = await this.analyses.rascunho(actor, companyId, code, number);
    const pe = await this.pe(análise.id, peId);

    const arquivo = await this.files.uploadAnalysisPhoto({
      accountId: actor.accountId,
      companyId,
      equipmentId: máquina.id,
      analysisId: análise.id,
      actorUserId: actor.userId,
      folder: `pes/${pe.id}`,
      category: 'ANALYSIS_PE_PHOTO',
      bytes,
    });
    await this.prisma.peAssessment.update({ where: { id: pe.id }, data: { photoFileId: arquivo.id } });
    if (pe.photo) await this.files.remove(pe.photo);

    return foto(this.files, arquivo);
  }

  async removePhoto(actor: SessionScope, companyId: string, code: string, number: number, peId: string): Promise<void> {
    const { análise } = await this.analyses.rascunho(actor, companyId, code, number);
    const pe = await this.pe(análise.id, peId);
    if (!pe.photo) return;

    await this.prisma.peAssessment.update({ where: { id: pe.id }, data: { photoFileId: null } });
    await this.files.remove(pe.photo);
  }

  // ── Apoio ──────────────────────────────────────────────────────────────────

  private async pe(analysisId: string, peId: string): Promise<PeComFoto> {
    const pe = await this.prisma.peAssessment.findFirst({ where: { id: peId, analysisId }, include: FOTO_DO_PE });
    if (!pe) throw new NotFoundException();
    return pe;
  }

  /** Cada item citado existe no catálogo de normas — sem repetição, na ordem em que veio (D13). */
  private async normasConferidas(entrada: string[] | undefined): Promise<string[]> {
    const ids = [...new Set(entrada ?? [])];
    if (ids.length > 0 && (await this.prisma.standard.count({ where: { id: { in: ids } } })) !== ids.length) {
      throw new BadRequestException({ statusCode: 400, field: 'violatedStandardIds', message: 'Há item de norma que não existe no catálogo.' });
    }
    return ids;
  }

  /** Dois PE novos ao mesmo tempo podem ler o mesmo número; o segundo tenta de novo. */
  private async criar(operação: () => Promise<PeComFoto>): Promise<PeComFoto> {
    for (let tentativa = 0; ; tentativa++) {
      try {
        return await operação();
      } catch (erro) {
        const repetido = erro instanceof Prisma.PrismaClientKnownRequestError && erro.code === 'P2002';
        if (!repetido || tentativa >= 2) throw erro;
      }
    }
  }

  private registrar(
    actor: SessionScope,
    action: (typeof AuditAction)[keyof typeof AuditAction],
    análise: { id: string; companyId: string; equipmentId: string },
    after: Record<string, unknown>,
  ) {
    return this.audit.record({
      action,
      entityType: 'Analysis',
      entityId: análise.id,
      accountId: actor.accountId,
      actorUserId: actor.userId,
      after: { ...after, companyId: análise.companyId, equipmentId: análise.equipmentId },
    });
  }
}

function aparado(valor: string | null | undefined): string | null {
  const limpo = valor?.trim() ?? '';
  return limpo === '' ? null : limpo;
}
