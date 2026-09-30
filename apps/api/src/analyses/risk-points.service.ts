import { BadRequestException, ConflictException, Injectable, NotFoundException } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import {
  calculateHrn,
  safetyCategory,
  type HrnScore,
  type RecognitionPhoto,
  type RiskPointDto,
  type RiskPointUpsert,
  type SafetyCategory,
} from '@normatiza/shared';

import { AuditAction, AuditService } from '../audit/audit.service';
import { SessionScope } from '../authorization/permission.service';
import { tabelaHrnDe } from '../catalogs/hrn-table';
import { PrismaService } from '../prisma/prisma.service';
import { FilesService } from '../storage/files.service';
import { AnalysesService } from './analyses.service';
import { PontoComFoto, foto, pontoDto } from './risk-point-dto';


/** Os catálogos que o ponto cita, e a tabela onde cada lista é conferida (D13). */
const CATÁLOGOS = [
  { campo: 'hazardOriginIds', tabela: 'hazardOrigin', nome: 'origem do perigo' },
  { campo: 'hazardConsequenceIds', tabela: 'hazardConsequence', nome: 'consequência' },
  { campo: 'existingProtectionIds', tabela: 'protection', nome: 'proteção' },
  { campo: 'violatedStandardIds', tabela: 'standard', nome: 'item de norma' },
] as const;

/**
 * Os pontos de perigo da análise (docs/produto/03 §5.2, 04 §4). O ponto é
 * gravado inteiro pelo id do aparelho (D11): regravar não duplica, e o app
 * offline manda o que tiver quando a conexão voltar. Só em rascunho.
 */
@Injectable()
export class RiskPointsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly analyses: AnalysesService,
    private readonly files: FilesService,
    private readonly audit: AuditService,
  ) {}

  async upsert(
    actor: SessionScope,
    companyId: string,
    code: string,
    number: number,
    pointId: string,
    dto: RiskPointUpsert,
  ): Promise<RiskPointDto> {
    const { análise, máquina } = await this.analyses.rascunho(actor, companyId, code, number);

    const existente = await this.prisma.riskPoint.findUnique({ where: { id: pointId } });
    if (existente && existente.analysisId !== análise.id) throw new ConflictException('Esse id já é de outro ponto.');

    const dados = { ...(await this.dados(análise.hrnTableVersionId, dto)) };

    let gravado: PontoComFoto;
    if (existente) {
      gravado = await this.prisma.riskPoint.update({ where: { id: pointId }, data: dados, include: { hazardPhoto: true } });
    } else {
      gravado = await this.criar(() =>
        this.prisma.$transaction(async (tx) => {
          const { _max } = await tx.riskPoint.aggregate({ where: { analysisId: análise.id }, _max: { number: true } });
          return tx.riskPoint.create({
            data: {
              id: pointId,
              accountId: actor.accountId,
              analysisId: análise.id,
              equipmentId: máquina.id,
              number: (_max.number ?? 0) + 1,
              createdByUserId: actor.userId,
              ...dados,
            },
            include: { hazardPhoto: true },
          });
        }),
      );
    }

    await this.registrar(actor, AuditAction.ANALYSIS_RISK_POINT_SAVED, análise, { pointId, number: gravado.number, ...dados });
    return this.dto(gravado);
  }

  /** Exclui do rascunho e renumera os seguintes: o laudo nunca pula um número. */
  async remove(actor: SessionScope, companyId: string, code: string, number: number, pointId: string): Promise<void> {
    const { análise } = await this.analyses.rascunho(actor, companyId, code, number);
    const ponto = await this.ponto(análise.id, pointId);

    await this.prisma.$transaction(async (tx) => {
      await tx.riskPoint.delete({ where: { id: ponto.id } });
      // Em ordem crescente: o número que acabou de vagar é o que o próximo ocupa.
      const seguintes = await tx.riskPoint.findMany({
        where: { analysisId: análise.id, number: { gt: ponto.number } },
        orderBy: { number: 'asc' },
        select: { id: true, number: true },
      });
      for (const s of seguintes) await tx.riskPoint.update({ where: { id: s.id }, data: { number: s.number - 1 } });
    });
    if (ponto.hazardPhoto) await this.files.remove(ponto.hazardPhoto);

    await this.registrar(actor, AuditAction.ANALYSIS_RISK_POINT_DELETED, análise, { pointId, number: ponto.number });
  }

  /** A foto do "antes". Trocar apaga a anterior: é rascunho, nenhum laudo aponta para ela. */
  async setPhoto(
    actor: SessionScope,
    companyId: string,
    code: string,
    number: number,
    pointId: string,
    bytes: Buffer,
  ): Promise<RecognitionPhoto> {
    const { análise, máquina } = await this.analyses.rascunho(actor, companyId, code, number);
    const ponto = await this.ponto(análise.id, pointId);

    const arquivo = await this.files.uploadAnalysisPhoto({
      accountId: actor.accountId,
      companyId,
      equipmentId: máquina.id,
      analysisId: análise.id,
      actorUserId: actor.userId,
      folder: `risk-points/${ponto.id}`,
      category: 'ANALYSIS_RISK_POINT_PHOTO',
      bytes,
    });
    await this.prisma.riskPoint.update({ where: { id: ponto.id }, data: { hazardPhotoFileId: arquivo.id } });
    if (ponto.hazardPhoto) await this.files.remove(ponto.hazardPhoto);

    return foto(this.files, arquivo);
  }

  async removePhoto(actor: SessionScope, companyId: string, code: string, number: number, pointId: string): Promise<void> {
    const { análise } = await this.analyses.rascunho(actor, companyId, code, number);
    const ponto = await this.ponto(análise.id, pointId);
    if (!ponto.hazardPhoto) return;

    await this.prisma.riskPoint.update({ where: { id: ponto.id }, data: { hazardPhotoFileId: null } });
    await this.files.remove(ponto.hazardPhoto);
  }

  dto(p: PontoComFoto): Promise<RiskPointDto> {
    return pontoDto(this.files, p);
  }

  // ── Apoio ──────────────────────────────────────────────────────────────────

  private async ponto(analysisId: string, pointId: string): Promise<PontoComFoto> {
    const ponto = await this.prisma.riskPoint.findFirst({ where: { id: pointId, analysisId }, include: { hazardPhoto: true } });
    if (!ponto) throw new NotFoundException();
    return ponto;
  }

  /** O ponto inteiro, conferido: o que não vier é limpo. */
  private async dados(hrnTableVersionId: string, dto: RiskPointUpsert) {
    const listas = await this.listasConferidas(dto);

    let hrn: HrnScore | null = null;
    if (dto.hrn) {
      const tabela = await this.prisma.hrnTableVersion.findUniqueOrThrow({ where: { id: hrnTableVersionId } });
      try {
        hrn = calculateHrn(dto.hrn, tabelaHrnDe(tabela));
      } catch (erro) {
        throw campo('hrn', (erro as Error).message);
      }
    }

    let categoria: SafetyCategory | null = null;
    if (dto.safetyCategory) {
      try {
        categoria = safetyCategory(dto.safetyCategory);
      } catch (erro) {
        throw campo('safetyCategory', (erro as Error).message);
      }
    }

    return {
      location: aparado(dto.location),
      ...listas,
      hrnFe: hrn?.fe ?? null,
      hrnPe: hrn?.pe ?? null,
      hrnMpl: hrn?.mpl ?? null,
      hrnNp: hrn?.np ?? null,
      hrnResult: hrn?.result ?? null,
      hrnLevel: hrn?.level ?? null,
      safetySeverity: categoria?.severity ?? null,
      safetyFrequency: categoria?.frequency ?? null,
      safetyPossibility: categoria?.possibility ?? null,
      safetyCategory: categoria?.category ?? null,
      suggestedSolution: aparado(dto.suggestedSolution),
    };
  }

  /** Cada id citado existe no catálogo — sem repetição, na ordem em que veio. */
  private async listasConferidas(dto: RiskPointUpsert) {
    const saída = {} as Record<(typeof CATÁLOGOS)[number]['campo'], string[]>;
    for (const c of CATÁLOGOS) {
      const ids = [...new Set(dto[c.campo] ?? [])];
      if (ids.length > 0) {
        const delegate = this.prisma[c.tabela] as unknown as { count(args: { where: { id: { in: string[] } } }): Promise<number> };
        const achados = await delegate.count({ where: { id: { in: ids } } });
        if (achados !== ids.length) throw campo(c.campo, `Há ${c.nome} que não existe no catálogo.`);
      }
      saída[c.campo] = ids;
    }
    return saída;
  }

  /** Dois pontos novos ao mesmo tempo podem ler o mesmo número; o segundo tenta de novo. */
  private async criar(operação: () => Promise<PontoComFoto>): Promise<PontoComFoto> {
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

function campo(field: string, message: string) {
  return new BadRequestException({ statusCode: 400, field, message });
}
