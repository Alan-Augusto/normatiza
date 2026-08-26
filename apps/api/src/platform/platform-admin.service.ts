import { ForbiddenException, Injectable, NotFoundException } from '@nestjs/common';

import type { PlatformAdmin } from '@normatiza/shared';

import { AuditAction, AuditService } from '../audit/audit.service';
import { PrismaService } from '../prisma/prisma.service';

/**
 * O Contexto 0 — o backoffice da plataforma.
 *
 * O acesso é uma dimensão **sobreposta** ao login que a pessoa já tem, e não um
 * papel de vínculo: quem é dono da plataforma normalmente também é Engenheiro
 * Responsável de uma consultoria, e obrigá-lo a um segundo e-mail seria atrito
 * sem ganho nenhum.
 *
 * Reparar que este serviço **não** dá acesso a dado de cliente. O isolamento de
 * conta continua valendo para o admin como para qualquer outro: para olhar
 * dentro de uma consultoria ele usa a impersonação auditada, que deixa rastro
 * com nome. Um superusuário que enxerga tudo o tempo todo não deixa rastro
 * nenhum.
 */
@Injectable()
export class PlatformAdminService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly audit: AuditService,
  ) {}

  async isPlatformAdmin(userId: string): Promise<boolean> {
    const concessão = await this.prisma.platformAdmin.findUnique({
      where: { userId },
      include: { user: true },
    });

    if (!concessão || concessão.revokedAt) return false;

    // Desligar a pessoa fecha todas as portas de uma vez. Se o Contexto 0
    // sobrevivesse ao desligamento, tirar o acesso de alguém exigiria lembrar de
    // dois lugares — e um dia alguém esquece.
    return concessão.user?.status !== 'DISABLED';
  }

  async list(): Promise<PlatformAdmin[]> {
    const concessões = await this.prisma.platformAdmin.findMany({
      include: { user: true },
      orderBy: { grantedAt: 'asc' },
    });

    return concessões.map((c) => ({
      id: c.id,
      userId: c.userId,
      name: c.user.name,
      email: c.user.email,
      grantedByUserId: c.grantedByUserId ?? undefined,
      grantedAt: c.grantedAt.toISOString(),
      revokedAt: c.revokedAt?.toISOString(),
    }));
  }

  /**
   * Só admin faz admin.
   *
   * Se um Engenheiro Responsável pudesse conceder, o teto de papel — hoje uma
   * tabela fechada e auditável — ganharia uma aresta que leva ao topo.
   */
  async grant(userId: string, byUserId: string): Promise<void> {
    await this.assertÉAdmin(byUserId);

    const alvo = await this.prisma.user.findUnique({ where: { id: userId } });
    if (!alvo) throw new NotFoundException();

    await this.prisma.platformAdmin.upsert({
      where: { userId },
      create: { userId, grantedByUserId: byUserId },
      // Reconceder limpa a revogação e registra quem reconcedeu; a linha original
      // é a mesma, porque `userId` é único.
      update: { revokedAt: null, grantedByUserId: byUserId, grantedAt: new Date() },
    });

    await this.audit.record({
      action: AuditAction.PLATFORM_ADMIN_GRANTED,
      entityType: 'PlatformAdmin',
      entityId: userId,
      actorUserId: byUserId,
    });
  }

  async revoke(userId: string, byUserId: string): Promise<void> {
    await this.assertÉAdmin(byUserId);

    // Um sistema sem nenhum admin exige acesso ao banco para se recuperar.
    // Barrar a auto-revogação não impede todos os caminhos até lá, mas remove o
    // mais fácil: trancar a própria porta por engano.
    if (userId === byUserId) {
      throw new ForbiddenException('Um admin não pode revogar o próprio acesso.');
    }

    await this.prisma.platformAdmin.update({
      where: { userId },
      data: { revokedAt: new Date() },
    });

    await this.audit.record({
      action: AuditAction.PLATFORM_ADMIN_REVOKED,
      entityType: 'PlatformAdmin',
      entityId: userId,
      actorUserId: byUserId,
    });
  }

  private async assertÉAdmin(userId: string): Promise<void> {
    if (!(await this.isPlatformAdmin(userId))) throw new ForbiddenException();
  }
}
