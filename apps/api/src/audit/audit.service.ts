import { Injectable, Logger } from '@nestjs/common';

import { PrismaService } from '../prisma/prisma.service';

/** Os eventos de identidade. Vive como constante para não virar string solta. */
export const AuditAction = {
  LOGIN: 'auth.login',
  LOGIN_FAILED: 'auth.login_failed',
  LOGOUT: 'auth.logout',
  TOKEN_REUSE_DETECTED: 'auth.token_reuse_detected',
  PASSWORD_RESET_REQUESTED: 'auth.password_reset_requested',
  PASSWORD_RESET: 'auth.password_reset',
  PASSWORD_REHASHED: 'auth.password_rehashed',
  INVITATION_CREATED: 'invitation.created',
  INVITATION_ACCEPTED: 'invitation.accepted',
  INVITATION_RESENT: 'invitation.resent',
  INVITATION_REVOKED: 'invitation.revoked',
  PLATFORM_ADMIN_GRANTED: 'platform_admin.granted',
  PLATFORM_ADMIN_REVOKED: 'platform_admin.revoked',
} as const;

export type AuditActionValue = (typeof AuditAction)[keyof typeof AuditAction];

export interface AuditEvent {
  action: AuditActionValue;
  entityType: string;
  entityId?: string;
  accountId?: string;
  actorUserId?: string;
  before?: unknown;
  after?: unknown;
  reason?: string;
  ipAddress?: string;
  userAgent?: string;
}

@Injectable()
export class AuditService {
  private readonly logger = new Logger(AuditService.name);

  constructor(private readonly prisma: PrismaService) {}

  /**
   * Registra o evento.
   *
   * **Nunca derruba a operação que está auditando.** Um banco indisponível não
   * pode impedir alguém de fazer login — mas a falha vai para o log, porque
   * auditoria que some em silêncio deixa de ser prova.
   */
  async record(event: AuditEvent): Promise<void> {
    try {
      await this.prisma.auditLog.create({
        data: {
          accountId: event.accountId,
          actorUserId: event.actorUserId,
          action: event.action,
          entityType: event.entityType,
          entityId: event.entityId,
          before: event.before as never,
          after: event.after as never,
          reason: event.reason,
          ipAddress: event.ipAddress,
          userAgent: event.userAgent,
        },
      });
    } catch (erro) {
      this.logger.error(`Falha ao gravar auditoria de ${event.action}`, erro as Error);
    }
  }
}
