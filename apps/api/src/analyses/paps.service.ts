import { BadRequestException, ConflictException, Injectable, NotFoundException } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { PAP_SECTIONS, type PapDto, type PapSection, type PapUpsert, type RecognitionPhoto } from '@normatiza/shared';

import { AuditAction, AuditService } from '../audit/audit.service';
import { SessionScope } from '../authorization/permission.service';
import { PrismaService } from '../prisma/prisma.service';
import { FilesService } from '../storage/files.service';
import { AnalysesService } from './analyses.service';
import { FOTOS_DO_PAP, FOTO_DA_SEÇÃO, PapComFotos, papDto, respostasDoPap } from './pap-dto';
import { foto } from './risk-point-dto';

/**
 * Os PAP da análise (docs/produto/03 §5.2, 04 §4): um por conjunto de comando.
 * Gravado inteiro pelo id do aparelho, como o ponto de risco (D11). Só em
 * rascunho.
 */
@Injectable()
export class PapsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly analyses: AnalysesService,
    private readonly files: FilesService,
    private readonly audit: AuditService,
  ) {}

  async upsert(actor: SessionScope, companyId: string, code: string, number: number, papId: string, dto: PapUpsert): Promise<PapDto> {
    const { análise, máquina } = await this.analyses.rascunho(actor, companyId, code, number);

    const existente = await this.prisma.papAssessment.findUnique({ where: { id: papId } });
    if (existente && existente.analysisId !== análise.id) throw new ConflictException('Esse id já é de outro PAP.');

    const dados = {
      location: aparado(dto.location),
      answers: respostasDoPap(dto.sections) as unknown as Prisma.InputJsonValue,
      violatedStandardIds: await this.normasConferidas(dto.violatedStandardIds),
      solution: aparado(dto.solution),
    };

    let gravado: PapComFotos;
    if (existente) {
      gravado = await this.prisma.papAssessment.update({ where: { id: papId }, data: dados, include: FOTOS_DO_PAP });
    } else {
      gravado = await this.criar(() =>
        this.prisma.$transaction(async (tx) => {
          const { _max } = await tx.papAssessment.aggregate({ where: { analysisId: análise.id }, _max: { number: true } });
          return tx.papAssessment.create({
            data: {
              id: papId,
              accountId: actor.accountId,
              analysisId: análise.id,
              equipmentId: máquina.id,
              number: (_max.number ?? 0) + 1,
              createdByUserId: actor.userId,
              ...dados,
            },
            include: FOTOS_DO_PAP,
          });
        }),
      );
    }

    await this.registrar(actor, AuditAction.ANALYSIS_PAP_SAVED, análise, { papId, number: gravado.number, ...dados });
    return papDto(this.files, gravado);
  }

  /** Exclui do rascunho e renumera os seguintes, como os pontos de risco. */
  async remove(actor: SessionScope, companyId: string, code: string, number: number, papId: string): Promise<void> {
    const { análise } = await this.analyses.rascunho(actor, companyId, code, number);
    const pap = await this.pap(análise.id, papId);

    await this.prisma.$transaction(async (tx) => {
      await tx.papAssessment.delete({ where: { id: pap.id } });
      const seguintes = await tx.papAssessment.findMany({
        where: { analysisId: análise.id, number: { gt: pap.number } },
        orderBy: { number: 'asc' },
        select: { id: true, number: true },
      });
      for (const s of seguintes) await tx.papAssessment.update({ where: { id: s.id }, data: { number: s.number - 1 } });
    });
    for (const s of PAP_SECTIONS) {
      const arquivo = pap[FOTO_DA_SEÇÃO[s.key].relação];
      if (arquivo) await this.files.remove(arquivo);
    }

    await this.registrar(actor, AuditAction.ANALYSIS_PAP_DELETED, análise, { papId, number: pap.number });
  }

  /** A foto do botão auditado na seção. Trocar apaga a anterior: é rascunho. */
  async setPhoto(
    actor: SessionScope,
    companyId: string,
    code: string,
    number: number,
    papId: string,
    section: string,
    bytes: Buffer,
  ): Promise<RecognitionPhoto> {
    const seção = seçãoDe(section);
    const { análise, máquina } = await this.analyses.rascunho(actor, companyId, code, number);
    const pap = await this.pap(análise.id, papId);

    const arquivo = await this.files.uploadAnalysisPhoto({
      accountId: actor.accountId,
      companyId,
      equipmentId: máquina.id,
      analysisId: análise.id,
      actorUserId: actor.userId,
      folder: `paps/${pap.id}/${seção}`,
      category: 'ANALYSIS_PAP_PHOTO',
      bytes,
    });
    await this.prisma.papAssessment.update({ where: { id: pap.id }, data: { [FOTO_DA_SEÇÃO[seção].coluna]: arquivo.id } });
    const anterior = pap[FOTO_DA_SEÇÃO[seção].relação];
    if (anterior) await this.files.remove(anterior);

    return foto(this.files, arquivo);
  }

  async removePhoto(actor: SessionScope, companyId: string, code: string, number: number, papId: string, section: string): Promise<void> {
    const seção = seçãoDe(section);
    const { análise } = await this.analyses.rascunho(actor, companyId, code, number);
    const pap = await this.pap(análise.id, papId);
    const arquivo = pap[FOTO_DA_SEÇÃO[seção].relação];
    if (!arquivo) return;

    await this.prisma.papAssessment.update({ where: { id: pap.id }, data: { [FOTO_DA_SEÇÃO[seção].coluna]: null } });
    await this.files.remove(arquivo);
  }

  // ── Apoio ──────────────────────────────────────────────────────────────────

  private async pap(analysisId: string, papId: string): Promise<PapComFotos> {
    const pap = await this.prisma.papAssessment.findFirst({ where: { id: papId, analysisId }, include: FOTOS_DO_PAP });
    if (!pap) throw new NotFoundException();
    return pap;
  }

  /** Cada item citado existe no catálogo de normas — sem repetição, na ordem em que veio (D13). */
  private async normasConferidas(entrada: string[] | undefined): Promise<string[]> {
    const ids = [...new Set(entrada ?? [])];
    if (ids.length > 0 && (await this.prisma.standard.count({ where: { id: { in: ids } } })) !== ids.length) {
      throw new BadRequestException({ statusCode: 400, field: 'violatedStandardIds', message: 'Há item de norma que não existe no catálogo.' });
    }
    return ids;
  }

  /** Dois PAP novos ao mesmo tempo podem ler o mesmo número; o segundo tenta de novo. */
  private async criar(operação: () => Promise<PapComFotos>): Promise<PapComFotos> {
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

function seçãoDe(section: string): PapSection {
  if (!PAP_SECTIONS.some((s) => s.key === section)) throw new NotFoundException();
  return section as PapSection;
}

function aparado(valor: string | null | undefined): string | null {
  const limpo = valor?.trim() ?? '';
  return limpo === '' ? null : limpo;
}
