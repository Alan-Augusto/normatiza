import { createHash, randomBytes } from 'node:crypto';

import { BadRequestException, ForbiddenException, Injectable } from '@nestjs/common';
import type { Invitation, User } from '@prisma/client';
import type { CreateInvitationRequest, InvitationSummary } from '@normatiza/shared';

import { AuditAction, AuditService } from '../audit/audit.service';
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
    private readonly audit: AuditService,
  ) {}

  /**
   * Valida os dois tetos no servidor — o de papel ("quem convida quem") e o de
   * escopo (subconjunto das empresas de quem convida) — e cria usuário, vínculos
   * e convite.
   */
  async create(inviter: SessionScope, dto: CreateInvitationRequest): Promise<ConviteEmitido> {
    // Os dois tetos são verificados **antes** de qualquer escrita: convite
    // recusado não pode deixar usuário órfão para trás.
    this.permissions.assertInviteWithinScope(inviter, dto.companyIds);

    for (const papel of dto.roles) {
      if (!this.permissions.canInviteRole(inviter, papel)) {
        throw new ForbiddenException(`Você não pode conceder o papel ${papel}.`);
      }
    }

    const token = randomBytes(32).toString('base64url');
    const email = dto.email.trim().toLowerCase();

    const { user, invitation } = await this.prisma.$transaction(async (tx) => {
      const user = await tx.user.create({
        data: {
          accountId: inviter.accountId,
          name: dto.name,
          email,
          phone: dto.phone,
          jobTitle: dto.jobTitle,
          status: 'INVITED',
          invitedByUserId: inviter.userId,
          createdByUserId: inviter.userId,
        },
      });

      await tx.membership.createMany({
        data: dto.companyIds.map((companyId) => ({
          accountId: inviter.accountId,
          userId: user.id,
          companyId,
          roles: dto.roles,
          executorType: dto.executorType,
          createdByUserId: inviter.userId,
        })),
      });

      const invitation = await tx.invitation.create({
        data: {
          accountId: inviter.accountId,
          userId: user.id,
          invitedByUserId: inviter.userId,
          roles: dto.roles,
          // Snapshot: reavaliar o escopo no aceite deixaria o teto móvel.
          companyIds: dto.companyIds,
          executorType: dto.executorType,
          tokenHash: digest(token),
          expiresAt: expiraEm(VALIDADE_DO_CONVITE_EM_DIAS),
        },
      });

      return { user, invitation };
    });

    await this.audit.record({
      action: AuditAction.INVITATION_CREATED,
      entityType: 'Invitation',
      entityId: invitation.id,
      accountId: inviter.accountId,
      actorUserId: inviter.userId,
      // O escopo concedido é o que se quer poder auditar depois. O token, não.
      after: { email, roles: dto.roles, companyIds: dto.companyIds },
    });

    return { invitation: paraContrato(invitation, user), token };
  }

  /** Aceitar é definir a senha. O token é de uso único. */
  async accept(token: string, password: string): Promise<void> {
    const convite = await this.prisma.invitation.findUnique({
      where: { tokenHash: digest(token) },
    });

    if (!convite || convite.status !== 'PENDING' || convite.expiresAt <= new Date()) {
      throw new BadRequestException('Convite inválido, expirado ou já utilizado.');
    }

    const passwordHash = await this.passwords.hash(password);

    await this.prisma.$transaction([
      this.prisma.user.update({
        where: { id: convite.userId },
        data: {
          passwordHash,
          passwordAlgo: 'ARGON2ID',
          status: 'ACTIVE',
          // Clicar no link do convite já prova o controle da caixa postal.
          emailConfirmedAt: new Date(),
        },
      }),
      this.prisma.invitation.update({
        where: { id: convite.id },
        data: { status: 'ACCEPTED', acceptedAt: new Date() },
      }),
    ]);

    await this.audit.record({
      action: AuditAction.INVITATION_ACCEPTED,
      entityType: 'Invitation',
      entityId: convite.id,
      accountId: convite.accountId,
      actorUserId: convite.userId,
    });
  }

  /** Rotaciona o token do convite pendente — não abre um segundo. */
  async resend(inviter: SessionScope, invitationId: string): Promise<ConviteEmitido> {
    const convite = await this.buscaPendente(inviter, invitationId);
    const token = randomBytes(32).toString('base64url');

    const atualizado = await this.prisma.invitation.update({
      where: { id: convite.id },
      data: { tokenHash: digest(token), expiresAt: expiraEm(VALIDADE_DO_CONVITE_EM_DIAS) },
      include: { user: true },
    });

    await this.audit.record({
      action: AuditAction.INVITATION_RESENT,
      entityType: 'Invitation',
      entityId: convite.id,
      accountId: inviter.accountId,
      actorUserId: inviter.userId,
      reason: 'token anterior invalidado',
    });

    return { invitation: paraContrato(atualizado, atualizado.user), token };
  }

  async revoke(inviter: SessionScope, invitationId: string): Promise<void> {
    const convite = await this.buscaPendente(inviter, invitationId);

    await this.prisma.invitation.update({
      where: { id: convite.id },
      data: { status: 'REVOKED', revokedAt: new Date() },
    });

    await this.audit.record({
      action: AuditAction.INVITATION_REVOKED,
      entityType: 'Invitation',
      entityId: convite.id,
      accountId: inviter.accountId,
      actorUserId: inviter.userId,
    });
  }

  private async buscaPendente(inviter: SessionScope, invitationId: string): Promise<Invitation> {
    const convite = await this.prisma.invitation.findUniqueOrThrow({
      where: { id: invitationId },
    });

    // Convite de outra conta não é "proibido": para quem está de fora, não existe.
    this.permissions.assertSameAccount(inviter, convite);

    if (convite.status !== 'PENDING') {
      throw new BadRequestException('Este convite não está mais pendente.');
    }

    return convite;
  }
}

function digest(token: string): string {
  return createHash('sha256').update(token).digest('hex');
}

function expiraEm(dias: number): Date {
  return new Date(Date.now() + dias * 24 * 60 * 60 * 1000);
}

function paraContrato(invitation: Invitation, user: User): InvitationSummary {
  return {
    id: invitation.id,
    userId: invitation.userId,
    name: user.name,
    email: user.email,
    roles: invitation.roles,
    companyIds: invitation.companyIds,
    status: invitation.status,
    expiresAt: invitation.expiresAt.toISOString(),
    invitedByUserId: invitation.invitedByUserId,
    createdAt: invitation.createdAt.toISOString(),
  };
}
