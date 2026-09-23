import {
  BadRequestException,
  Body,
  Controller,
  Delete,
  Get,
  HttpCode,
  HttpStatus,
  Param,
  Patch,
  Post,
  Put,
  Query,
  Req,
  UploadedFile,
  UseGuards,
  UseInterceptors,
} from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import type {
  CompanyDetail,
  CompanyGroupOption,
  CompanyListItem,
  CompanyView,
} from '@normatiza/shared';

import { AuthService } from '../auth/auth.service';
import { AuthenticatedRequest, JwtAuthGuard } from '../auth/jwt-auth.guard';
import { LOGO_MAX_BYTES } from '../storage/files.service';
import { CompaniesService } from './companies.service';
import { CompanyGroupQueryDto, CompanyListQueryDto, CompanyUpsertDto } from './dto/company.dto';

/**
 * O cadastro de empresas.
 *
 * Sem guarda de papel na porta, pelo mesmo motivo da Equipe: a alçada é por
 * empresa — a Carla administra a BRF e não a JBS —, e quem responde isso é o
 * serviço, linha a linha.
 */
@Controller('companies')
@UseGuards(JwtAuthGuard)
export class CompaniesController {
  constructor(
    private readonly companies: CompaniesService,
    private readonly auth: AuthService,
  ) {}

  @Get()
  async list(
    @Req() req: AuthenticatedRequest,
    @Query() query: CompanyListQueryDto,
  ): Promise<CompanyListItem[]> {
    return this.companies.list(await this.escopo(req), query);
  }

  @Get(':companyId')
  async get(@Req() req: AuthenticatedRequest, @Param('companyId') companyId: string): Promise<CompanyView> {
    return this.companies.get(await this.escopo(req), companyId);
  }

  @Post()
  async create(@Req() req: AuthenticatedRequest, @Body() dto: CompanyUpsertDto): Promise<CompanyDetail> {
    return this.companies.create(await this.escopo(req), dto);
  }

  @Patch(':companyId')
  async update(
    @Req() req: AuthenticatedRequest,
    @Param('companyId') companyId: string,
    @Body() dto: CompanyUpsertDto,
  ): Promise<CompanyDetail> {
    return this.companies.update(await this.escopo(req), companyId, dto);
  }

  @Post(':companyId/deactivate')
  @HttpCode(HttpStatus.NO_CONTENT)
  async deactivate(@Req() req: AuthenticatedRequest, @Param('companyId') companyId: string): Promise<void> {
    await this.companies.deactivate(await this.escopo(req), companyId);
  }

  @Post(':companyId/reactivate')
  @HttpCode(HttpStatus.NO_CONTENT)
  async reactivate(@Req() req: AuthenticatedRequest, @Param('companyId') companyId: string): Promise<void> {
    await this.companies.reactivate(await this.escopo(req), companyId);
  }

  /**
   * O limite do multer é o **teto de transporte**: corta o envio no meio em vez
   * de receber 50 MB para recusar depois. A regra de negócio — 2 MB, e só
   * PNG/JPG/WebP lidos dos bytes — continua no `FilesService`.
   */
  @Put(':companyId/logo')
  @UseInterceptors(FileInterceptor('file', { limits: { fileSize: LOGO_MAX_BYTES, files: 1 } }))
  async setLogo(
    @Req() req: AuthenticatedRequest,
    @Param('companyId') companyId: string,
    @UploadedFile() file: { buffer: Buffer } | undefined,
  ): Promise<{ logoUrl: string | null }> {
    if (!file) throw new BadRequestException('Envie a imagem no campo `file`.');
    return this.companies.setLogo(await this.escopo(req), companyId, file.buffer);
  }

  @Delete(':companyId/logo')
  @HttpCode(HttpStatus.NO_CONTENT)
  async removeLogo(@Req() req: AuthenticatedRequest, @Param('companyId') companyId: string): Promise<void> {
    await this.companies.removeLogo(await this.escopo(req), companyId);
  }

  private escopo(req: AuthenticatedRequest) {
    return this.auth.buildScope(req.auth!.userId);
  }
}

@Controller('company-groups')
@UseGuards(JwtAuthGuard)
export class CompanyGroupsController {
  constructor(
    private readonly companies: CompaniesService,
    private readonly auth: AuthService,
  ) {}

  @Get()
  async list(
    @Req() req: AuthenticatedRequest,
    @Query() query: CompanyGroupQueryDto,
  ): Promise<CompanyGroupOption[]> {
    return this.companies.listGroups(await this.auth.buildScope(req.auth!.userId), query.q);
  }
}
