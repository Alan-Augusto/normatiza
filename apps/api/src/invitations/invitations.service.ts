import { Injectable } from '@nestjs/common';
import type { CreateInvitationRequest, InvitationSummary } from '@normatiza/shared';

import { PermissionService, SessionScope } from '../authorization/permission.service';
import { PasswordService } from '../auth/password.service';
import { PrismaService } from '../prisma/prisma.service';

/** Quantos dias um convite vale. Depois disso, precisa ser reenviado. */
export const VALIDADE_DO_CONVITE_EM_DIAS = 7;

export interface ConviteEmitido {
  invitation: InvitationSummary;
  /** O token em claro, só para montar o link do e-mail. Nunca é persistido. */
  token: string;
}

/**
 * O convite é a única porta de entrada do sistema — não há auto-cadastro.
 * O usuário já nasce aqui, em `INVITED`; aceitar é definir a senha.
 */
@Injectable()
export class InvitationsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly permissions: PermissionService,
    private readonly passwords: PasswordService,
  ) {}

  /**
   * Valida os dois tetos no servidor — o de papel ("quem convida quem") e o de
   * escopo (subconjunto das empresas de quem convida) — e cria usuário, vínculos
   * e convite.
   */
  create(_inviter: SessionScope, _dto: CreateInvitationRequest): Promise<ConviteEmitido> {
    throw new Error('InvitationsService.create não implementado');
  }

  /** Aceitar é definir a senha. O token é de uso único. */
  accept(_token: string, _password: string): Promise<void> {
    throw new Error('InvitationsService.accept não implementado');
  }

  /** Rotaciona o token do convite pendente — não abre um segundo. */
  resend(_inviter: SessionScope, _invitationId: string): Promise<ConviteEmitido> {
    throw new Error('InvitationsService.resend não implementado');
  }

  revoke(_inviter: SessionScope, _invitationId: string): Promise<void> {
    throw new Error('InvitationsService.revoke não implementado');
  }
}
