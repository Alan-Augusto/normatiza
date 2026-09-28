import {
  BadRequestException,
  Body,
  Controller,
  Delete,
  Get,
  HttpCode,
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
  EquipmentDetail,
  EquipmentDuplicates,
  EquipmentListItem,
  MachineTypeOption,
  SectorCreateResponse,
  SectorListItem,
} from '@normatiza/shared';

import { AuthService } from '../auth/auth.service';
import { AuthenticatedRequest, JwtAuthGuard } from '../auth/jwt-auth.guard';
import { EQUIPMENT_PHOTO_MAX_BYTES } from '../storage/files.service';
import {
  EquipmentDuplicatesQueryDto,
  EquipmentListQueryDto,
  EquipmentUpsertDto,
  MachineTypeCreateDto,
  MachineTypeQueryDto,
  SectorMergeDto,
  SectorUpsertDto,
} from './dto/inventory.dto';
import { EquipmentsService } from './equipments.service';
import { MachineTypesService } from './machine-types.service';
import { SectorsService } from './sectors.service';

/**
 * O inventário mora sob a empresa (`/companies/:companyId/…`): o escopo é o
 * dela, e nenhum prefixo novo precisa entrar no nginx. Sem guarda de papel na
 * porta, como as empresas — a alçada é por empresa, e quem responde é o serviço.
 */
@Controller('companies/:companyId/equipments')
@UseGuards(JwtAuthGuard)
export class EquipmentsController {
  constructor(
    private readonly equipments: EquipmentsService,
    private readonly auth: AuthService,
  ) {}

  @Get()
  async list(
    @Req() req: AuthenticatedRequest,
    @Param('companyId') companyId: string,
    @Query() query: EquipmentListQueryDto,
  ): Promise<EquipmentListItem[]> {
    return this.equipments.list(await this.escopo(req), companyId, query);
  }

  /** Antes de `:code`: "duplicates" não é código, mas a rota de um segmento o engoliria. */
  @Get('duplicates')
  async duplicates(
    @Req() req: AuthenticatedRequest,
    @Param('companyId') companyId: string,
    @Query() query: EquipmentDuplicatesQueryDto,
  ): Promise<EquipmentDuplicates> {
    return this.equipments.duplicates(await this.escopo(req), companyId, query);
  }

  @Get(':code')
  async get(
    @Req() req: AuthenticatedRequest,
    @Param('companyId') companyId: string,
    @Param('code') code: string,
  ): Promise<EquipmentDetail> {
    return this.equipments.get(await this.escopo(req), companyId, code);
  }

  @Post()
  async create(
    @Req() req: AuthenticatedRequest,
    @Param('companyId') companyId: string,
    @Body() dto: EquipmentUpsertDto,
  ): Promise<EquipmentDetail> {
    return this.equipments.create(await this.escopo(req), companyId, dto);
  }

  @Patch(':code')
  async update(
    @Req() req: AuthenticatedRequest,
    @Param('companyId') companyId: string,
    @Param('code') code: string,
    @Body() dto: EquipmentUpsertDto,
  ): Promise<EquipmentDetail> {
    return this.equipments.update(await this.escopo(req), companyId, code, dto);
  }

  @Post(':code/deactivate')
  @HttpCode(204)
  async deactivate(@Req() req: AuthenticatedRequest, @Param('companyId') companyId: string, @Param('code') code: string) {
    await this.equipments.deactivate(await this.escopo(req), companyId, code);
  }

  @Post(':code/reactivate')
  @HttpCode(204)
  async reactivate(@Req() req: AuthenticatedRequest, @Param('companyId') companyId: string, @Param('code') code: string) {
    await this.equipments.reactivate(await this.escopo(req), companyId, code);
  }

  @Delete(':code')
  @HttpCode(204)
  async remove(@Req() req: AuthenticatedRequest, @Param('companyId') companyId: string, @Param('code') code: string) {
    await this.equipments.remove(await this.escopo(req), companyId, code);
  }

  /** O limite do multer é o teto de transporte; a regra de tipo e tamanho é do `FilesService`. */
  @Put(':code/photo')
  @UseInterceptors(FileInterceptor('file', { limits: { fileSize: EQUIPMENT_PHOTO_MAX_BYTES, files: 1 } }))
  async setPhoto(
    @Req() req: AuthenticatedRequest,
    @Param('companyId') companyId: string,
    @Param('code') code: string,
    @UploadedFile() file: { buffer: Buffer } | undefined,
  ): Promise<{ photoUrl: string | null; thumbnailUrl: string | null }> {
    if (!file) throw new BadRequestException('Envie a imagem no campo `file`.');
    return this.equipments.setPhoto(await this.escopo(req), companyId, code, file.buffer);
  }

  @Delete(':code/photo')
  @HttpCode(204)
  async removePhoto(@Req() req: AuthenticatedRequest, @Param('companyId') companyId: string, @Param('code') code: string) {
    await this.equipments.removePhoto(await this.escopo(req), companyId, code);
  }

  private escopo(req: AuthenticatedRequest) {
    return this.auth.buildScope(req.auth!.userId);
  }
}

@Controller('companies/:companyId/sectors')
@UseGuards(JwtAuthGuard)
export class SectorsController {
  constructor(
    private readonly sectors: SectorsService,
    private readonly auth: AuthService,
  ) {}

  @Get()
  async list(@Req() req: AuthenticatedRequest, @Param('companyId') companyId: string): Promise<SectorListItem[]> {
    return this.sectors.list(await this.escopo(req), companyId);
  }

  @Post()
  async create(
    @Req() req: AuthenticatedRequest,
    @Param('companyId') companyId: string,
    @Body() dto: SectorUpsertDto,
  ): Promise<SectorCreateResponse> {
    return this.sectors.create(await this.escopo(req), companyId, dto);
  }

  @Patch(':sectorId')
  async update(
    @Req() req: AuthenticatedRequest,
    @Param('companyId') companyId: string,
    @Param('sectorId') sectorId: string,
    @Body() dto: SectorUpsertDto,
  ): Promise<SectorListItem> {
    return this.sectors.update(await this.escopo(req), companyId, sectorId, dto);
  }

  @Post(':sectorId/merge')
  @HttpCode(204)
  async merge(
    @Req() req: AuthenticatedRequest,
    @Param('companyId') companyId: string,
    @Param('sectorId') sectorId: string,
    @Body() dto: SectorMergeDto,
  ) {
    await this.sectors.merge(await this.escopo(req), companyId, sectorId, dto);
  }

  @Delete(':sectorId')
  @HttpCode(204)
  async remove(@Req() req: AuthenticatedRequest, @Param('companyId') companyId: string, @Param('sectorId') sectorId: string) {
    await this.sectors.remove(await this.escopo(req), companyId, sectorId);
  }

  private escopo(req: AuthenticatedRequest) {
    return this.auth.buildScope(req.auth!.userId);
  }
}

/** O catálogo é da conta, não de uma empresa: prefixo próprio, que entra no nginx. */
@Controller('machine-types')
@UseGuards(JwtAuthGuard)
export class MachineTypesController {
  constructor(
    private readonly machineTypes: MachineTypesService,
    private readonly auth: AuthService,
  ) {}

  @Get()
  async list(@Req() req: AuthenticatedRequest, @Query() query: MachineTypeQueryDto): Promise<MachineTypeOption[]> {
    return this.machineTypes.list(await this.escopo(req), query.q);
  }

  @Post()
  async create(@Req() req: AuthenticatedRequest, @Body() dto: MachineTypeCreateDto): Promise<MachineTypeOption> {
    return this.machineTypes.create(await this.escopo(req), dto);
  }

  private escopo(req: AuthenticatedRequest) {
    return this.auth.buildScope(req.auth!.userId);
  }
}
