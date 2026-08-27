import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import { COMPANY_SCOPED_ROLES, ROLE_LABEL, ROLE_SIDE } from '@normatiza/shared';
import type { DisableUserPreview, DisableUserRequest, PersonRef, Role } from '@normatiza/shared';

import { AuditAction, AuditService } from '../audit/audit.service';
import { SessionScope } from '../authorization/permission.service';
import { TokenService } from '../auth/token.service';
import { PrismaService } from '../prisma/prisma.service';
import { MemberPolicyService, TargetMember } from './member-policy.service';

/** Um papel que ficaria sem dono se a pessoa saísse hoje. */
interface PapelEmRisco {
  companyId: string;
  companyName: string;
  role: Role;
}

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
    const { alvo } = await this.carregar(actor, targetUserId);

    try {
      this.policy.assertCanDisable(actor, alvo);
    } catch (recusa) {
      return {
        allowed: false,
        blockedReason: (recusa as Error).message,
        requiresSuccessor: false,
        successorReasons: [],
        eligibleSuccessors: [],
      };
    }

    const riscos = await this.papéisEmRisco(alvo);

    return {
      allowed: true,
      requiresSuccessor: riscos.length > 0,
      successorReasons: riscos.map(
        (r) => `É a única pessoa com o papel de ${ROLE_LABEL[r.role]} em ${r.companyName}.`,
      ),
      eligibleSuccessors: await this.candidatos(actor, alvo, riscos),
    };
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
    const { alvo } = await this.carregar(actor, targetUserId);

    this.policy.assertCanDisable(actor, alvo);

    const riscos = await this.papéisEmRisco(alvo);
    const sucessor = await this.resolverSucessor(actor, alvo, riscos, dto.successorUserId);

    await this.prisma.$transaction(async (tx) => {
      if (sucessor) {
        // O sucessor herda o papel **antes** de os vínculos caírem: depois,
        // não haveria mais o que ler para saber o que ele deveria herdar.
        for (const risco of riscos) {
          const vínculo = await tx.membership.findFirstOrThrow({
            where: { userId: sucessor.id, companyId: risco.companyId, isActive: true },
          });

          if (!vínculo.roles.includes(risco.role)) {
            await tx.membership.update({
              where: { id: vínculo.id },
              data: { roles: [...vínculo.roles, risco.role] },
            });
          }
        }

        // "Nada fica órfão" ([01 §5]): quem estava abaixo passa a apontar para
        // quem assumiu, não para alguém que saiu.
        await tx.user.updateMany({
          where: { invitedByUserId: alvo.userId },
          data: { invitedByUserId: sucessor.id },
        });
      }

      await tx.user.update({
        where: { id: alvo.userId },
        data: {
          status: 'DISABLED',
          disabledAt: new Date(),
          succeededByUserId: sucessor?.id,
        },
      });

      await tx.membership.updateMany({
        where: { userId: alvo.userId, isActive: true },
        data: { isActive: false },
      });
    });

    await this.tokens.revokeAllForUser(alvo.userId, 'usuário desligado');

    await this.audit.record({
      action: AuditAction.USER_DISABLED,
      entityType: 'User',
      entityId: alvo.userId,
      accountId: actor.accountId,
      actorUserId: actor.userId,
      reason: dto.reason,
      before: { status: alvo.status, vínculos: alvo.memberships.filter((v) => v.isActive).length },
    });

    if (sucessor) {
      await this.audit.record({
        action: AuditAction.USER_SUCCEEDED,
        entityType: 'User',
        entityId: alvo.userId,
        accountId: actor.accountId,
        actorUserId: actor.userId,
        after: { successorUserId: sucessor.id, papéis: riscos.map((r) => r.role) },
      });
    }
  }

  // ── O que quebra ao sair ───────────────────────────────────────────────────

  /**
   * Só os papéis de escopo-empresa entram aqui: são eles que respondem por uma
   * empresa inteira. Tirar um Executor entre cinco não quebra nada, e exigir
   * sucessor nesse caso viraria a burocracia que D4 rejeita.
   */
  private async papéisEmRisco(alvo: TargetMember): Promise<PapelEmRisco[]> {
    const riscos: PapelEmRisco[] = [];

    for (const vínculo of alvo.memberships.filter((v) => v.isActive)) {
      for (const papel of vínculo.roles) {
        if (!COMPANY_SCOPED_ROLES.includes(papel)) continue;

        const outros = await this.prisma.membership.count({
          where: {
            companyId: vínculo.companyId,
            isActive: true,
            roles: { has: papel },
            userId: { not: alvo.userId },
          },
        });

        if (outros > 0) continue;

        const empresa = await this.prisma.company.findUniqueOrThrow({
          where: { id: vínculo.companyId },
          select: { tradeName: true, isActive: true },
        });

        // Empresa inativa não precisa de Gestor: não há operação para conduzir.
        if (!empresa.isActive) continue;

        riscos.push({ companyId: vínculo.companyId, companyName: empresa.tradeName, role: papel });
      }
    }

    return riscos;
  }

  /**
   * Quem pode herdar.
   *
   * Três filtros, e cada um responde a uma coisa diferente: já ter vínculo com
   * a empresa (D17 — suceder não concede empresa nova), estar do mesmo lado do
   * papel (D18 — Gestor é cargo do cliente, não da consultoria que a atende) e
   * não carregar papel de escopo-empresa em outra empresa, que o índice parcial
   * recusaria depois de a tela já ter oferecido.
   */
  private async candidatos(
    actor: SessionScope,
    alvo: TargetMember,
    riscos: PapelEmRisco[],
  ): Promise<PersonRef[]> {
    if (riscos.length === 0) return [];

    let candidatos: PersonRef[] | null = null;

    for (const risco of riscos) {
      const pessoas = await this.prisma.user.findMany({
        where: {
          accountId: actor.accountId,
          status: 'ACTIVE',
          id: { not: alvo.userId },
          memberships: { some: { companyId: risco.companyId, isActive: true } },
        },
        include: { memberships: { where: { isActive: true } } },
        orderBy: { name: 'asc' },
      });

      const aptos = pessoas.filter((pessoa) => {
        const aqui = pessoa.memberships.find((v) => v.companyId === risco.companyId);
        if (!aqui) return false;

        const mesmoLado = aqui.roles.some((p) => ROLE_SIDE[p] === ROLE_SIDE[risco.role]);
        if (!mesmoLado) return false;

        const jáTemEmOutra = pessoa.memberships.some(
          (v) =>
            v.companyId !== risco.companyId &&
            v.roles.some((p) => COMPANY_SCOPED_ROLES.includes(p)),
        );

        return !jáTemEmOutra;
      });

      const nesteRisco = aptos.map((p) => ({ id: p.id, name: p.name }));

      // Com mais de um papel em risco, o sucessor precisa servir para todos —
      // dois sucessores parciais deixariam metade do problema de pé.
      candidatos =
        candidatos === null
          ? nesteRisco
          : candidatos.filter((c) => nesteRisco.some((n) => n.id === c.id));
    }

    return candidatos ?? [];
  }

  private async resolverSucessor(
    actor: SessionScope,
    alvo: TargetMember,
    riscos: PapelEmRisco[],
    successorUserId?: string,
  ): Promise<PersonRef | null> {
    if (riscos.length === 0) return null;

    const elegíveis = await this.candidatos(actor, alvo, riscos);

    if (!successorUserId) {
      const motivos = riscos
        .map((r) => `${ROLE_LABEL[r.role]} em ${r.companyName}`)
        .join('; ');

      throw new BadRequestException(
        `Esta pessoa responde sozinha por ${motivos}. Escolha um sucessor para desligá-la.`,
      );
    }

    const escolhido = elegíveis.find((c) => c.id === successorUserId);

    if (!escolhido) {
      throw new BadRequestException(
        'A pessoa escolhida não pode herdar estes papéis. Confira a lista de sucessores possíveis.',
      );
    }

    return escolhido;
  }

  private async carregar(actor: SessionScope, targetUserId: string) {
    const pessoa = await this.prisma.user.findUnique({
      where: { id: targetUserId },
      include: { memberships: true, account: { select: { ownerUserId: true } } },
    });

    // Pessoa de outra conta não é "proibida": para quem está de fora, não existe.
    if (!pessoa || pessoa.accountId !== actor.accountId) {
      throw new NotFoundException();
    }

    const alvo: TargetMember = {
      userId: pessoa.id,
      status: pessoa.status,
      isAccountOwner: pessoa.account.ownerUserId === pessoa.id,
      memberships: pessoa.memberships.map((v) => ({
        companyId: v.companyId,
        roles: v.roles,
        isActive: v.isActive,
      })),
    };

    return { pessoa, alvo };
  }
}
