import {
  Body,
  Controller,
  Delete,
  Get,
  HttpCode,
  HttpStatus,
  Param,
  Patch,
  Post,
  Query,
  Req,
  UseGuards,
} from '@nestjs/common';
import type {
  CompanyTeam,
  DisableUserPreview,
  TeamMember,
} from '@normatiza/shared';

import {
  ChangePasswordDto,
  DisableUserDto,
  TeamListQueryDto,
  UpdateMembershipDto,
  UpdateProfileDto,
} from './dto/team.dto';
import { ProfileService } from './profile.service';
import { TeamService } from './team.service';
import { UserLifecycleService } from './user-lifecycle.service';
import { AuthService } from '../auth/auth.service';
import { AuthenticatedRequest, JwtAuthGuard } from '../auth/jwt-auth.guard';

/**
 * As pessoas da conta — o Contexto 1.
 *
 * Nenhuma rota aqui carrega guarda de papel. A alçada desta feature não é
 * "quem entra na tela", é "o que cada um pode fazer com **cada linha**", e isso
 * o `MemberPolicyService` responde por pessoa, dentro do serviço. Uma guarda de
 * papel na porta daria uma segunda resposta, mais grossa, para a mesma pergunta.
 */
@Controller('users')
@UseGuards(JwtAuthGuard)
export class UsersController {
  constructor(
    private readonly team: TeamService,
    private readonly lifecycle: UserLifecycleService,
    private readonly profile: ProfileService,
    private readonly auth: AuthService,
  ) {}

  @Get()
  async list(
    @Req() req: AuthenticatedRequest,
    @Query() filtros: TeamListQueryDto,
  ): Promise<TeamMember[]> {
    const escopo = await this.auth.buildScope(req.auth!.userId);
    return this.team.listAccountTeam(escopo, filtros);
  }

  /** O próprio perfil. `me` vem do token — nunca de um id na rota (D7). */
  @Patch('me')
  @HttpCode(HttpStatus.NO_CONTENT)
  async updateProfile(
    @Req() req: AuthenticatedRequest,
    @Body() dto: UpdateProfileDto,
  ): Promise<void> {
    await this.profile.updateProfile(req.auth!.userId, dto);
  }

  @Post('me/password')
  @HttpCode(HttpStatus.NO_CONTENT)
  async changePassword(
    @Req() req: AuthenticatedRequest,
    @Body() dto: ChangePasswordDto,
  ): Promise<void> {
    await this.profile.changePassword(req.auth!.userId, dto);
  }

  /** O que a tela precisa saber antes de oferecer o desligamento (D14). */
  @Get(':id/disable-preview')
  async disablePreview(
    @Req() req: AuthenticatedRequest,
    @Param('id') id: string,
  ): Promise<DisableUserPreview> {
    const escopo = await this.auth.buildScope(req.auth!.userId);
    return this.lifecycle.disablePreview(escopo, id);
  }

  @Post(':id/disable')
  @HttpCode(HttpStatus.NO_CONTENT)
  async disable(
    @Req() req: AuthenticatedRequest,
    @Param('id') id: string,
    @Body() dto: DisableUserDto,
  ): Promise<void> {
    const escopo = await this.auth.buildScope(req.auth!.userId);
    await this.lifecycle.disable(escopo, id, dto);
  }
}

/**
 * Quem tem acesso a **esta** empresa — o Contexto 2.
 *
 * A projeção não nomeia outra empresa nem a conta (D15): é por isso que esta
 * rota não é `GET /users?companyId=`, que devolveria a projeção da conta com um
 * filtro e traria o escopo de cada pessoa junto.
 */
@Controller('companies/:companyId/members')
@UseGuards(JwtAuthGuard)
export class CompanyMembersController {
  constructor(
    private readonly team: TeamService,
    private readonly auth: AuthService,
  ) {}

  @Get()
  async list(
    @Req() req: AuthenticatedRequest,
    @Param('companyId') companyId: string,
  ): Promise<CompanyTeam> {
    const escopo = await this.auth.buildScope(req.auth!.userId);
    return this.team.listCompanyMembers(escopo, companyId);
  }
}

/** O vínculo em si: trocar papel e encerrar o acesso àquela empresa. */
@Controller('memberships')
@UseGuards(JwtAuthGuard)
export class MembershipsController {
  constructor(
    private readonly team: TeamService,
    private readonly auth: AuthService,
  ) {}

  @Patch(':id')
  @HttpCode(HttpStatus.NO_CONTENT)
  async updateRoles(
    @Req() req: AuthenticatedRequest,
    @Param('id') id: string,
    @Body() dto: UpdateMembershipDto,
  ): Promise<void> {
    const escopo = await this.auth.buildScope(req.auth!.userId);
    await this.team.updateMembershipRoles(escopo, id, dto);
  }

  /**
   * Remover da empresa, não da conta (D8). O verbo `DELETE` é da rota, não do
   * banco: o vínculo é desativado, nunca apagado (D6).
   */
  @Delete(':id')
  @HttpCode(HttpStatus.NO_CONTENT)
  async remove(@Req() req: AuthenticatedRequest, @Param('id') id: string): Promise<void> {
    const escopo = await this.auth.buildScope(req.auth!.userId);
    await this.team.removeFromCompany(escopo, id);
  }
}
