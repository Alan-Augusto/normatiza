import { Body, Controller, HttpCode, HttpStatus, Param, Post, Req, UseGuards } from '@nestjs/common';
import type { InvitationSummary } from '@normatiza/shared';

import { CreateInvitationDto } from './dto/create-invitation.dto';
import { InvitationsService } from './invitations.service';
import { AcceptInvitationDto } from '../auth/dto/auth.dto';
import { AuthenticatedRequest, JwtAuthGuard } from '../auth/jwt-auth.guard';

@Controller('invitations')
export class InvitationsController {
  constructor(private readonly invitations: InvitationsService) {}

  @Post()
  @UseGuards(JwtAuthGuard)
  create(
    @Req() _req: AuthenticatedRequest,
    @Body() _dto: CreateInvitationDto,
  ): Promise<InvitationSummary> {
    throw new Error('InvitationsController.create não implementado');
  }

  /** Aberta de propósito: quem aceita o convite ainda não tem sessão. */
  @Post(':token/accept')
  @HttpCode(HttpStatus.NO_CONTENT)
  accept(@Param('token') _token: string, @Body() _dto: AcceptInvitationDto): Promise<void> {
    throw new Error('InvitationsController.accept não implementado');
  }
}
