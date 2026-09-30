import {
  BadRequestException,
  Body,
  Controller,
  Delete,
  Get,
  HttpCode,
  Param,
  ParseIntPipe,
  ParseUUIDPipe,
  Post,
  Put,
  Req,
  Res,
  UploadedFile,
  UseGuards,
  UseInterceptors,
} from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import type { Response } from 'express';
import type { AnalysisDetail, AnalysisListItem, PersonRef, RecognitionPhoto, RiskPointDto } from '@normatiza/shared';

import { AuthService } from '../auth/auth.service';
import { AuthenticatedRequest, JwtAuthGuard } from '../auth/jwt-auth.guard';
import { EQUIPMENT_PHOTO_MAX_BYTES } from '../storage/files.service';
import { AnalysesService } from './analyses.service';
import { AnalysisCreateDto, AnalysisSheetUpdateDto, RiskPointUpsertDto } from './dto/analyses.dto';
import { RiskPointsService } from './risk-points.service';

/**
 * A análise mora no equipamento (`/companies/:companyId/equipments/:code/…`):
 * nenhum prefixo novo no nginx. Sem guarda de papel na porta — a alçada é da
 * consultoria na empresa, e quem responde é o serviço.
 */
@Controller('companies/:companyId/equipments/:code/analyses')
@UseGuards(JwtAuthGuard)
export class AnalysesController {
  constructor(
    private readonly analyses: AnalysesService,
    private readonly riskPoints: RiskPointsService,
    private readonly auth: AuthService,
  ) {}

  @Get()
  async list(
    @Req() req: AuthenticatedRequest,
    @Param('companyId') companyId: string,
    @Param('code') code: string,
  ): Promise<AnalysisListItem[]> {
    return this.analyses.list(await this.escopo(req), companyId, code);
  }

  /** 201 quando nasce; 200 quando o `id` do aparelho já era de uma análise (reenvio). */
  @Post()
  async create(
    @Req() req: AuthenticatedRequest,
    @Res({ passthrough: true }) res: Response,
    @Param('companyId') companyId: string,
    @Param('code') code: string,
    @Body() dto: AnalysisCreateDto,
  ): Promise<AnalysisDetail> {
    const { analysis, created } = await this.analyses.create(await this.escopo(req), companyId, code, dto);
    res.status(created ? 201 : 200);
    return analysis;
  }

  /** Antes de `:number`: o segmento não é número, e a rota de um segmento o engoliria. */
  @Get('field-technicians')
  async fieldTechnicians(
    @Req() req: AuthenticatedRequest,
    @Param('companyId') companyId: string,
    @Param('code') code: string,
  ): Promise<PersonRef[]> {
    return this.analyses.fieldTechnicians(await this.escopo(req), companyId, code);
  }

  @Get(':number')
  async get(
    @Req() req: AuthenticatedRequest,
    @Param('companyId') companyId: string,
    @Param('code') code: string,
    @Param('number', ParseIntPipe) number: number,
  ): Promise<AnalysisDetail> {
    return this.analyses.get(await this.escopo(req), companyId, code, number);
  }

  @Put(':number/sheet')
  async updateSheet(
    @Req() req: AuthenticatedRequest,
    @Param('companyId') companyId: string,
    @Param('code') code: string,
    @Param('number', ParseIntPipe) number: number,
    @Body() dto: AnalysisSheetUpdateDto,
  ): Promise<AnalysisDetail> {
    return this.analyses.updateSheet(await this.escopo(req), companyId, code, number, dto);
  }

  /** O limite do multer é o teto de transporte; a regra de tipo e tamanho é do `FilesService`. */
  @Put(':number/photos/:view')
  @UseInterceptors(FileInterceptor('file', { limits: { fileSize: EQUIPMENT_PHOTO_MAX_BYTES, files: 1 } }))
  async setPhoto(
    @Req() req: AuthenticatedRequest,
    @Param('companyId') companyId: string,
    @Param('code') code: string,
    @Param('number', ParseIntPipe) number: number,
    @Param('view') view: string,
    @UploadedFile() file: { buffer: Buffer } | undefined,
  ): Promise<RecognitionPhoto> {
    if (!file) throw new BadRequestException('Envie a imagem no campo `file`.');
    return this.analyses.setPhoto(await this.escopo(req), companyId, code, number, view, file.buffer);
  }

  @Delete(':number/photos/:view')
  @HttpCode(204)
  async removePhoto(
    @Req() req: AuthenticatedRequest,
    @Param('companyId') companyId: string,
    @Param('code') code: string,
    @Param('number', ParseIntPipe) number: number,
    @Param('view') view: string,
  ) {
    await this.analyses.removePhoto(await this.escopo(req), companyId, code, number, view);
  }

  // ── Pontos de risco: gravados inteiros pelo id do aparelho (D11) ─────────

  @Put(':number/risk-points/:pointId')
  async upsertRiskPoint(
    @Req() req: AuthenticatedRequest,
    @Param('companyId') companyId: string,
    @Param('code') code: string,
    @Param('number', ParseIntPipe) number: number,
    @Param('pointId', new ParseUUIDPipe()) pointId: string,
    @Body() dto: RiskPointUpsertDto,
  ): Promise<RiskPointDto> {
    return this.riskPoints.upsert(await this.escopo(req), companyId, code, number, pointId, dto);
  }

  @Delete(':number/risk-points/:pointId')
  @HttpCode(204)
  async removeRiskPoint(
    @Req() req: AuthenticatedRequest,
    @Param('companyId') companyId: string,
    @Param('code') code: string,
    @Param('number', ParseIntPipe) number: number,
    @Param('pointId', new ParseUUIDPipe()) pointId: string,
  ) {
    await this.riskPoints.remove(await this.escopo(req), companyId, code, number, pointId);
  }

  @Put(':number/risk-points/:pointId/photo')
  @UseInterceptors(FileInterceptor('file', { limits: { fileSize: EQUIPMENT_PHOTO_MAX_BYTES, files: 1 } }))
  async setRiskPointPhoto(
    @Req() req: AuthenticatedRequest,
    @Param('companyId') companyId: string,
    @Param('code') code: string,
    @Param('number', ParseIntPipe) number: number,
    @Param('pointId', new ParseUUIDPipe()) pointId: string,
    @UploadedFile() file: { buffer: Buffer } | undefined,
  ): Promise<RecognitionPhoto> {
    if (!file) throw new BadRequestException('Envie a imagem no campo `file`.');
    return this.riskPoints.setPhoto(await this.escopo(req), companyId, code, number, pointId, file.buffer);
  }

  @Delete(':number/risk-points/:pointId/photo')
  @HttpCode(204)
  async removeRiskPointPhoto(
    @Req() req: AuthenticatedRequest,
    @Param('companyId') companyId: string,
    @Param('code') code: string,
    @Param('number', ParseIntPipe) number: number,
    @Param('pointId', new ParseUUIDPipe()) pointId: string,
  ) {
    await this.riskPoints.removePhoto(await this.escopo(req), companyId, code, number, pointId);
  }

  /** Descartar o rascunho. Análise concluída não se apaga: a recusa é 409. */
  @Delete(':number')
  @HttpCode(204)
  async discard(
    @Req() req: AuthenticatedRequest,
    @Param('companyId') companyId: string,
    @Param('code') code: string,
    @Param('number', ParseIntPipe) number: number,
  ) {
    await this.analyses.discard(await this.escopo(req), companyId, code, number);
  }

  private escopo(req: AuthenticatedRequest) {
    return this.auth.buildScope(req.auth!.userId);
  }
}
