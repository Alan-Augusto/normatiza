import { createHash, randomBytes, randomUUID } from 'node:crypto';

import { Injectable, UnauthorizedException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { JwtService } from '@nestjs/jwt';
import type { AccessTokenClaims } from '@normatiza/shared';

import { AuditAction, AuditService } from '../audit/audit.service';
import { EnvironmentVariables } from '../config/env.validation';
import { PrismaService } from '../prisma/prisma.service';

export interface IssuedTokens {
  accessToken: string;
  /** Devolvido em claro **uma única vez**. No banco só existe o hash. */
  refreshToken: string;
  /** Segundos até o access token expirar. */
  expiresIn: number;
}

/** De onde veio a sessão. Serve à trilha de auditoria, não à autorização. */
export interface SessionContext {
  userAgent?: string;
  ipAddress?: string;
}

const UNIDADES: Record<string, number> = { ms: 1, s: 1_000, m: 60_000, h: 3_600_000, d: 86_400_000 };

/** Converte `15m`, `30d`, `900` no número de milissegundos correspondente. */
export function duraçãoEmMs(valor: string): number {
  const m = /^(\d+)(ms|s|m|h|d)?$/.exec(valor);
  if (!m) throw new Error(`Duração inválida: ${valor}`);

  return Number(m[1]) * (m[2] ? UNIDADES[m[2]] : 1_000);
}

@Injectable()
export class TokenService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly jwt: JwtService,
    private readonly config: ConfigService<EnvironmentVariables, true>,
    private readonly audit: AuditService,
  ) {}

  /** Abre uma sessão nova: um access token curto e uma família de refresh. */
  async issuePair(
    user: { id: string; accountId: string },
    context: SessionContext = {},
  ): Promise<IssuedTokens> {
    const { tokens } = await this.emitir(user, randomUUID(), context);
    return tokens;
  }

  /**
   * Troca um refresh token por um par novo e invalida o anterior.
   *
   * Se o token apresentado já tiver sido usado, trata-se como roubo: revoga a
   * **família inteira** e recusa. Não há como distinguir o ladrão da vítima —
   * derrubar os dois e exigir novo login é a única resposta honesta.
   */
  async rotate(refreshToken: string, context: SessionContext = {}): Promise<IssuedTokens> {
    const guardado = await this.prisma.refreshToken.findUnique({
      where: { tokenHash: this.digest(refreshToken) },
      include: { user: true },
    });

    if (!guardado) throw new UnauthorizedException();

    if (guardado.usedAt) {
      await this.revogarFamília(guardado.familyId, 'reuso-detectado');

      await this.audit.record({
        action: AuditAction.TOKEN_REUSE_DETECTED,
        entityType: 'RefreshToken',
        entityId: guardado.id,
        accountId: guardado.user.accountId,
        actorUserId: guardado.userId,
        reason: 'token já rotacionado foi apresentado de novo; a família inteira foi revogada',
        ipAddress: context.ipAddress,
        userAgent: context.userAgent,
      });

      throw new UnauthorizedException();
    }

    if (guardado.revokedAt || guardado.expiresAt <= new Date()) {
      throw new UnauthorizedException();
    }

    // O usuário pode ter sido desligado no meio da vida do refresh token — é
    // justamente para isso que ele é persistido, e não stateless.
    if (guardado.user.status !== 'ACTIVE') throw new UnauthorizedException();

    const novo = await this.emitir(
      { id: guardado.user.id, accountId: guardado.user.accountId },
      guardado.familyId,
      context,
    );

    await this.prisma.refreshToken.update({
      where: { id: guardado.id },
      data: {
        usedAt: new Date(),
        replacedByTokenId: novo.id,
      },
    });

    return novo.tokens;
  }

  /**
   * Logout: encerra apenas a sessão apresentada. Devolve de quem era a sessão,
   * para que o chamador possa registrá-la na trilha — `null` se o token não
   * correspondia a sessão nenhuma.
   */
  async revoke(refreshToken: string): Promise<{ userId: string; accountId: string } | null> {
    const guardado = await this.prisma.refreshToken.findUnique({
      where: { tokenHash: this.digest(refreshToken) },
      include: { user: { select: { accountId: true } } },
    });

    if (!guardado) return null;

    await this.prisma.refreshToken.updateMany({
      where: { id: guardado.id, revokedAt: null },
      data: { revokedAt: new Date(), revokedReason: 'logout' },
    });

    return { userId: guardado.userId, accountId: guardado.user.accountId };
  }

  /** Derruba todas as sessões do usuário — desligamento, troca de senha, revogação. */
  async revokeAllForUser(userId: string, reason: string): Promise<void> {
    await this.prisma.refreshToken.updateMany({
      where: { userId, revokedAt: null },
      data: { revokedAt: new Date(), revokedReason: reason },
    });
  }

  /** Lança se o token estiver expirado, adulterado ou assinado com outra chave. */
  verifyAccessToken(token: string): AccessTokenClaims {
    try {
      return this.jwt.verify<AccessTokenClaims>(token, {
        secret: this.config.get('JWT_ACCESS_SECRET', { infer: true }),
      });
    } catch {
      throw new UnauthorizedException();
    }
  }

  /** Quanto tempo o access token vale, em segundos. */
  get accessTokenTtlEmSegundos(): number {
    return duraçãoEmMs(this.config.get('JWT_ACCESS_TTL', { infer: true })) / 1_000;
  }

  private async emitir(
    user: { id: string; accountId: string },
    familyId: string,
    context: SessionContext,
  ) {
    const refreshToken = randomBytes(48).toString('base64url');
    const expiresIn = this.accessTokenTtlEmSegundos;

    const criado = await this.prisma.refreshToken.create({
      data: {
        userId: user.id,
        familyId,
        // Vazar o banco não pode ser o mesmo que vazar as sessões.
        tokenHash: this.digest(refreshToken),
        expiresAt: new Date(
          Date.now() + duraçãoEmMs(this.config.get('JWT_REFRESH_TTL', { infer: true })),
        ),
        userAgent: context.userAgent,
        ipAddress: context.ipAddress,
      },
    });

    const accessToken = this.jwt.sign(
      { accountId: user.accountId },
      {
        subject: user.id,
        secret: this.config.get('JWT_ACCESS_SECRET', { infer: true }),
        expiresIn,
      },
    );

    return { id: criado.id, tokens: { accessToken, refreshToken, expiresIn } };
  }

  private async revogarFamília(familyId: string, reason: string): Promise<void> {
    await this.prisma.refreshToken.updateMany({
      where: { familyId, revokedAt: null },
      data: { revokedAt: new Date(), revokedReason: reason },
    });
  }

  private digest(token: string): string {
    return createHash('sha256').update(token).digest('hex');
  }
}
