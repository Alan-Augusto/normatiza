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
  /** Papel trocado no vínculo. O `before`/`after` guarda os dois conjuntos. */
  MEMBERSHIP_ROLE_CHANGED: 'membership.role_changed',
  /** Saiu da empresa. Não é o mesmo que sair da conta (D8). */
  MEMBERSHIP_REMOVED: 'membership.removed',
  /** Saiu da conta: sessões revogadas e todos os vínculos derrubados (D8). */
  USER_DISABLED: 'user.disabled',
  /** Quem herdou o escopo de quem saiu (D4). */
  USER_SUCCEEDED: 'user.succeeded',
  PROFILE_UPDATED: 'user.profile_updated',
  PASSWORD_CHANGED: 'user.password_changed',
  PLATFORM_ADMIN_GRANTED: 'platform_admin.granted',
  PLATFORM_ADMIN_REVOKED: 'platform_admin.revoked',
  COMPANY_CREATED: 'company.created',
  /** O `before`/`after` guarda o cadastro inteiro: é o que prova quem mudou o endereço do laudo. */
  COMPANY_UPDATED: 'company.updated',
  COMPANY_DEACTIVATED: 'company.deactivated',
  COMPANY_REACTIVATED: 'company.reactivated',
  COMPANY_LOGO_CHANGED: 'company.logo_changed',
  EQUIPMENT_CREATED: 'equipment.created',
  EQUIPMENT_UPDATED: 'equipment.updated',
  EQUIPMENT_DEACTIVATED: 'equipment.deactivated',
  EQUIPMENT_REACTIVATED: 'equipment.reactivated',
  EQUIPMENT_DELETED: 'equipment.deleted',
  EQUIPMENT_PHOTO_CHANGED: 'equipment.photo_changed',
  SECTOR_CREATED: 'sector.created',
  SECTOR_UPDATED: 'sector.updated',
  SECTOR_MERGED: 'sector.merged',
  SECTOR_DELETED: 'sector.deleted',
  MACHINE_TYPE_CREATED: 'machine_type.created',
  ANALYSIS_CREATED: 'analysis.created',
  /** A etapa 1: tempos, regime, gestão de segurança e técnico de campo. */
  ANALYSIS_SHEET_UPDATED: 'analysis.sheet_updated',
  ANALYSIS_PHOTO_CHANGED: 'analysis.photo_changed',
  /** O rascunho apagado: o `before` guarda o que ele tinha, e é a única memória dele. */
  ANALYSIS_DISCARDED: 'analysis.discarded',
  ANALYSIS_RISK_POINT_SAVED: 'analysis.risk_point_saved',
  ANALYSIS_RISK_POINT_DELETED: 'analysis.risk_point_deleted',
  ANALYSIS_PAP_SAVED: 'analysis.pap_saved',
  ANALYSIS_PAP_DELETED: 'analysis.pap_deleted',
  ANALYSIS_PE_SAVED: 'analysis.pe_saved',
  ANALYSIS_PE_DELETED: 'analysis.pe_deleted',
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
