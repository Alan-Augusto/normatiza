import {
  Body,
  Controller,
  Delete,
  Get,
  HttpCode,
  HttpStatus,
  Param,
  Post,
  Req,
  UseGuards,
} from '@nestjs/common';

import type { PlatformAdmin } from '@normatiza/shared';

import { GrantPlatformAdminDto } from './dto/grant-platform-admin.dto';
import { PlatformAdminGuard } from './platform-admin.guard';
import { PlatformAdminService } from './platform-admin.service';
import { AuthenticatedRequest, JwtAuthGuard } from '../auth/jwt-auth.guard';

/**
 * Quem administra a plataforma. É a única rota do Contexto 0 que esta feature
 * entrega — contas, catálogos globais e impersonação vêm com as suas.
 */
@Controller('platform/admins')
@UseGuards(JwtAuthGuard, PlatformAdminGuard)
export class PlatformAdminController {
  constructor(private readonly platformAdmins: PlatformAdminService) {}

  @Get()
  list(): Promise<PlatformAdmin[]> {
    return this.platformAdmins.list();
  }

  @Post()
  @HttpCode(HttpStatus.NO_CONTENT)
  grant(@Req() req: AuthenticatedRequest, @Body() dto: GrantPlatformAdminDto): Promise<void> {
    return this.platformAdmins.grant(dto, req.auth!.userId);
  }

  @Delete(':userId')
  @HttpCode(HttpStatus.NO_CONTENT)
  revoke(@Req() req: AuthenticatedRequest, @Param('userId') userId: string): Promise<void> {
    return this.platformAdmins.revoke(userId, req.auth!.userId);
  }
}
