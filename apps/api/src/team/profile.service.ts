import { Injectable, UnauthorizedException } from '@nestjs/common';
import type { ChangePasswordRequest, UpdateProfileRequest } from '@normatiza/shared';

import { AuditAction, AuditService } from '../audit/audit.service';
import { PasswordService } from '../auth/password.service';
import { TokenService } from '../auth/token.service';
import { PrismaService } from '../prisma/prisma.service';

/**
 * O que a pessoa edita **em si mesma**.
 *
 * Não recebe `SessionScope` nem alçada nenhuma de propósito: aqui não existe
 * "editar o perfil de outro". O único sujeito possível é quem está autenticado,
 * e por isso o `userId` vem do token, nunca da rota.
 */
@Injectable()
export class ProfileService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly passwords: PasswordService,
    private readonly tokens: TokenService,
    private readonly audit: AuditService,
  ) {}

  /** Nome, telefone, cargo e registro profissional. **Nunca o e-mail** (D7). */
  async updateProfile(userId: string, dto: UpdateProfileRequest): Promise<void> {
    // Os campos são escolhidos um a um, nunca espalhados do corpo da requisição.
    // O corpo vem de fora: um espalhamento deixaria `email`, `accountId` ou
    // `status` entrarem pela porta lateral, e o tipo não defende em tempo de
    // execução — ele some na compilação.
    const permitido = {
      name: dto.name,
      phone: dto.phone,
      jobTitle: dto.jobTitle,
      registryType: dto.registryType,
      registryNumber: dto.registryNumber,
    };

    const dados = Object.fromEntries(
      Object.entries(permitido).filter(([, valor]) => valor !== undefined),
    );

    if (Object.keys(dados).length === 0) return;

    await this.prisma.user.update({ where: { id: userId }, data: dados });

    await this.audit.record({
      action: AuditAction.PROFILE_UPDATED,
      entityType: 'User',
      entityId: userId,
      actorUserId: userId,
      after: dados,
    });
  }

  /**
   * Troca a própria senha.
   *
   * Exige a senha atual mesmo havendo sessão válida: uma aba esquecida aberta
   * não pode bastar para trocar a credencial permanente.
   */
  async changePassword(userId: string, dto: ChangePasswordRequest): Promise<void> {
    const pessoa = await this.prisma.user.findUniqueOrThrow({ where: { id: userId } });

    const confere = await this.passwords.verify(
      {
        hash: pessoa.passwordHash,
        algo: pessoa.passwordAlgo,
        legacySalt: pessoa.legacyPasswordSalt,
      },
      dto.currentPassword,
    );

    if (!confere.valid) {
      throw new UnauthorizedException('Senha atual incorreta.');
    }

    await this.prisma.user.update({
      where: { id: userId },
      data: {
        passwordHash: await this.passwords.hash(dto.newPassword),
        passwordAlgo: 'ARGON2ID',
        // A senha nova é sempre Argon2id: o salt do legado deixa de fazer
        // sentido e ficar com ele guardado seria guardar credencial morta.
        legacyPasswordSalt: null,
      },
    });

    // Trocar a senha derruba **todas** as sessões, inclusive a de quem trocou.
    // Quem troca a senha por suspeitar de invasão espera exatamente isso; poupar
    // a sessão atual deixaria a do invasor de pé se o invasor fosse ele.
    await this.tokens.revokeAllForUser(userId, 'senha alterada');

    await this.audit.record({
      action: AuditAction.PASSWORD_CHANGED,
      entityType: 'User',
      entityId: userId,
      accountId: pessoa.accountId,
      actorUserId: userId,
    });
  }
}
