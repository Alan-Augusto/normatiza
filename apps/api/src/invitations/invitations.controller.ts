import {
  Body,
  Controller,
  Delete,
  HttpCode,
  HttpStatus,
  Param,
  Post,
  Req,
  UseGuards,
} from '@nestjs/common';

import type { InvitationSummary } from '@normatiza/shared';

import { CreateInvitationDto } from './dto/create-invitation.dto';
import { InvitationsService } from './invitations.service';
import { AcceptInvitationDto } from '../auth/dto/auth.dto';
import { AuthService } from '../auth/auth.service';
import { AuthenticatedRequest, JwtAuthGuard } from '../auth/jwt-auth.guard';
import { RateLimitCredencial } from '../auth/rate-limit';

@Controller('invitations')
export class InvitationsController {
  constructor(
    private readonly invitations: InvitationsService,
    private readonly auth: AuthService,
  ) {}

  @Post()
  @UseGuards(JwtAuthGuard)
  async create(
    @Req() req: AuthenticatedRequest,
    @Body() dto: CreateInvitationDto,
  ): Promise<InvitationSummary> {
    const escopo = await this.auth.buildScope(req.auth!.userId);
    const { invitation } = await this.invitations.create(escopo, dto);

    // O token em claro fica de fora da resposta de propósito: ele vai por e-mail,
    // para quem foi convidado. Devolvê-lo aqui daria a quem convida um atalho
    // para assumir o acesso alheio.
    return invitation;
  }

  /**
   * Aberta de propósito: quem aceita o convite ainda não tem sessão.
   *
   * O token vai no **corpo**, não na URL: caminho de URL acaba em log de
   * servidor, histórico de navegador e cabeçalho `Referer`. Um token de uso
   * único que abre uma conta não tem por que passar por lá.
   */
  @Post('accept')
  @HttpCode(HttpStatus.NO_CONTENT)
  @RateLimitCredencial()
  accept(@Body() dto: AcceptInvitationDto): Promise<void> {
    return this.invitations.accept(dto.token, dto.password);
  }

  @Post(':id/resend')
  @HttpCode(HttpStatus.NO_CONTENT)
  @UseGuards(JwtAuthGuard)
  async resend(@Req() req: AuthenticatedRequest, @Param('id') id: string): Promise<void> {
    const escopo = await this.auth.buildScope(req.auth!.userId);
    await this.invitations.resend(escopo, id);
  }

  @Delete(':id')
  @HttpCode(HttpStatus.NO_CONTENT)
  @UseGuards(JwtAuthGuard)
  async revoke(@Req() req: AuthenticatedRequest, @Param('id') id: string): Promise<void> {
    const escopo = await this.auth.buildScope(req.auth!.userId);
    await this.invitations.revoke(escopo, id);
  }
}
