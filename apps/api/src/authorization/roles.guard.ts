import {
  CanActivate,
  ExecutionContext,
  ForbiddenException,
  Injectable,
  UnauthorizedException,
} from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import type { Role } from '@normatiza/shared';

import { PermissionService } from './permission.service';
import { PAPÉIS_EXIGIDOS } from './roles.decorator';
import { AuthService } from '../auth/auth.service';
import { AuthenticatedRequest } from '../auth/jwt-auth.guard';

/** De onde a empresa alvo pode vir numa requisição. */
interface RequisiçãoComEmpresa extends AuthenticatedRequest {
  params: Record<string, string>;
  body: Record<string, unknown>;
}

@Injectable()
export class RolesGuard implements CanActivate {
  constructor(
    private readonly reflector: Reflector,
    private readonly permissions: PermissionService,
    private readonly auth: AuthService,
  ) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const exigidos = this.reflector.getAllAndOverride<Role[] | undefined>(PAPÉIS_EXIGIDOS, [
      context.getHandler(),
      context.getClass(),
    ]);

    if (!exigidos?.length) return true;

    const req = context.switchToHttp().getRequest<RequisiçãoComEmpresa>();
    if (!req.auth) throw new UnauthorizedException();

    const escopo = await this.auth.buildScope(req.auth.userId);
    const empresa = empresaAlvo(req);

    // Sem empresa na requisição, o papel vale se existir em qualquer vínculo.
    // Com empresa, precisa existir **naquela** — ser Gestor da BRF não autoriza
    // agir na Seara.
    const papéis = empresa
      ? this.permissions.effectiveRoles(escopo, empresa)
      : escopo.memberships.filter((m) => m.isActive).flatMap((m) => m.roles);

    if (!exigidos.some((papel) => papéis.includes(papel))) {
      throw new ForbiddenException('Seu papel não permite esta ação.');
    }

    return true;
  }
}

function empresaAlvo(req: RequisiçãoComEmpresa): string | undefined {
  return req.params?.companyId ?? (req.body?.companyId as string | undefined);
}
