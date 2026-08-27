import { Injectable } from '@nestjs/common';
import type { DisableUserPreview, DisableUserRequest } from '@normatiza/shared';

import { AuditService } from '../audit/audit.service';
import { SessionScope } from '../authorization/permission.service';
import { TokenService } from '../auth/token.service';
import { PrismaService } from '../prisma/prisma.service';
import { MemberPolicyService } from './member-policy.service';

/**
 * Desligar da conta — o fim do ciclo de vida.
 *
 * Não existe *delete* (D6): desligar é `disabledAt` mais sucessão. Apagar a
 * pessoa apagaria a autoria das evidências que ela entregou, e evidência é
 * prova.
 */
@Injectable()
export class UserLifecycleService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly policy: MemberPolicyService,
    private readonly tokens: TokenService,
    private readonly audit: AuditService,
  ) {}

  /**
   * O que a tela precisa saber **antes** de oferecer o desligamento (D14).
   *
   * Sem esta consulta, a tela adivinharia quando a saída quebra uma invariante:
   * ou pediria sucessor sempre — a burocracia que D4 rejeita — ou nunca, e o
   * erro do servidor apareceria na cara do usuário.
   */
  async disablePreview(actor: SessionScope, targetUserId: string): Promise<DisableUserPreview> {
    throw new Error('não implementado');
  }

  /**
   * Desliga, derruba todos os vínculos e revoga as sessões.
   *
   * A revogação de token é parte do ato, não um cuidado extra: sem ela a pessoa
   * desligada continua trabalhando com o refresh token que já tem, por até
   * trinta dias.
   */
  async disable(
    actor: SessionScope,
    targetUserId: string,
    dto: DisableUserRequest,
  ): Promise<void> {
    throw new Error('não implementado');
  }
}
