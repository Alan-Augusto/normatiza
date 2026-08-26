import { CanActivate, ExecutionContext, Injectable, NotFoundException } from '@nestjs/common';

import { AuthenticatedRequest } from '../auth/jwt-auth.guard';
import { PlatformAdminService } from './platform-admin.service';

/**
 * Porta do Contexto 0.
 *
 * Devolve **`404`, não `403`**, pelo mesmo motivo do isolamento de conta: para
 * quem não é admin da plataforma, o backoffice não é proibido — ele não existe.
 * Responder "proibido" confirmaria que há algo ali.
 *
 * Usar sempre junto do `JwtAuthGuard`: esta guarda só decide *quem*, e conta com
 * a requisição já autenticada.
 */
@Injectable()
export class PlatformAdminGuard implements CanActivate {
  constructor(private readonly platformAdmins: PlatformAdminService) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const req = context.switchToHttp().getRequest<AuthenticatedRequest>();
    const userId = req.auth?.userId;

    if (!userId || !(await this.platformAdmins.isPlatformAdmin(userId))) {
      throw new NotFoundException();
    }

    return true;
  }
}
