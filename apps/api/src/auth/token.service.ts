import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { JwtService } from '@nestjs/jwt';
import type { AccessTokenClaims } from '@normatiza/shared';

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

@Injectable()
export class TokenService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly jwt: JwtService,
    private readonly config: ConfigService<EnvironmentVariables, true>,
  ) {}

  /** Abre uma sessão nova: um access token curto e uma família de refresh. */
  issuePair(
    _user: { id: string; accountId: string },
    _context?: SessionContext,
  ): Promise<IssuedTokens> {
    throw new Error('TokenService.issuePair não implementado');
  }

  /**
   * Troca um refresh token por um par novo e invalida o anterior.
   *
   * Se o token apresentado já tiver sido usado, trata-se como roubo: revoga a
   * **família inteira** e recusa. Não há como distinguir o ladrão da vítima —
   * derrubar os dois e exigir novo login é a única resposta honesta.
   */
  rotate(_refreshToken: string, _context?: SessionContext): Promise<IssuedTokens> {
    throw new Error('TokenService.rotate não implementado');
  }

  /** Logout: encerra apenas a sessão apresentada. */
  revoke(_refreshToken: string): Promise<void> {
    throw new Error('TokenService.revoke não implementado');
  }

  /** Derruba todas as sessões do usuário — desligamento, troca de senha, revogação. */
  revokeAllForUser(_userId: string, _reason: string): Promise<void> {
    throw new Error('TokenService.revokeAllForUser não implementado');
  }

  /** Lança se o token estiver expirado, adulterado ou assinado com outra chave. */
  verifyAccessToken(_token: string): AccessTokenClaims {
    throw new Error('TokenService.verifyAccessToken não implementado');
  }
}
