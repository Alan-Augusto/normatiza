import { CanActivate, ExecutionContext, Injectable, UnauthorizedException } from '@nestjs/common';
import type { Request } from 'express';

import { TokenService } from './token.service';

/** O que a requisição passa a carregar depois de autenticada. */
export interface AuthenticatedRequest extends Request {
  auth?: { userId: string; accountId: string };
}

/**
 * Autenticação — só responde "quem é você". Autorização (papel e escopo) é do
 * `PermissionService`, e não acontece aqui.
 */
@Injectable()
export class JwtAuthGuard implements CanActivate {
  constructor(private readonly tokens: TokenService) {}

  canActivate(context: ExecutionContext): boolean {
    const req = context.switchToHttp().getRequest<AuthenticatedRequest>();
    const header = req.headers.authorization;

    if (!header?.startsWith('Bearer ')) {
      throw new UnauthorizedException();
    }

    const claims = this.tokens.verifyAccessToken(header.slice('Bearer '.length));
    req.auth = { userId: claims.sub, accountId: claims.accountId };

    return true;
  }
}
