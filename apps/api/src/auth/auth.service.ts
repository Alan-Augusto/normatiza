import { createHash, randomBytes } from 'node:crypto';

import { BadRequestException, Injectable, UnauthorizedException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import type { Account, Membership, Prisma, User as UserRow } from '@prisma/client';
import type {
  Account as AccountContract,
  ForgotPasswordResponse,
  LoginRequest,
  LoginResponse,
  MembershipWithCompany,
  SessionUser,
  User as UserContract,
} from '@normatiza/shared';

import { AccountSelectionRequiredException } from './account-selection-required.exception';
import { PasswordService } from './password.service';
import { SessionContext, TokenService } from './token.service';
import { AuditAction, AuditService } from '../audit/audit.service';
import { SessionScope } from '../authorization/permission.service';
import { EnvironmentVariables } from '../config/env.validation';
import { MailService } from '../mail/mail.service';
import { PlatformAdminService } from '../platform/platform-admin.service';
import { PrismaService } from '../prisma/prisma.service';

/**
 * Mensagem única para toda falha de autenticação — e-mail inexistente, senha
 * errada, usuário desligado, convite ainda não aceito. Uma mensagem específica
 * para cada caso seria um oráculo de quem existe no sistema.
 */
export const CREDENCIAIS_INVALIDAS = 'E-mail ou senha inválidos.';

/**
 * O que o serviço devolve internamente. O `refreshToken` **não** faz parte do
 * contrato de rede: quem decide se ele sai em cookie ou no corpo é o controller,
 * conforme o transporte que o cliente declarou (D5, D6).
 */
export interface AuthResult extends LoginResponse {
  refreshToken: string;
}

/** Uma hora é tempo de sobra para clicar num link de e-mail, e pouco para um roubo. */
const VALIDADE_DO_RESET_EM_MS = 60 * 60 * 1000;

type UsuárioComConta = UserRow & { account: Account };

@Injectable()
export class AuthService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly passwords: PasswordService,
    private readonly tokens: TokenService,
    private readonly audit: AuditService,
    private readonly platformAdmins: PlatformAdminService,
    private readonly mail: MailService,
    private readonly config: ConfigService<EnvironmentVariables, true>,
  ) {}

  /**
   * Autentica por e-mail e senha.
   *
   * Recusa de e-mail inexistente e de senha errada são **indistinguíveis** —
   * mesma mensagem, mesmo status. Dizer "esse e-mail não existe" é confirmar
   * quem é cliente de quem.
   */
  async login(dto: LoginRequest, context: SessionContext = {}): Promise<AuthResult> {
    const candidatos = (await this.prisma.user.findMany({
      where: { email: normalizaEmail(dto.email) },
      include: { account: true },
    })) as UsuárioComConta[];

    // A conta informada, quando existe, é só um filtro — não é credencial.
    // A senha continua sendo verificada normalmente contra aquele usuário.
    const noEscopo = dto.accountId
      ? candidatos.filter((c) => c.accountId === dto.accountId)
      : candidatos;

    const autenticados: { user: UsuárioComConta; mustRehash: boolean }[] = [];

    for (const candidato of noEscopo) {
      // Desligado e convidado-sem-senha não entram na conta de candidatos: não
      // podem entrar, e também não podem aparecer numa lista de escolha.
      if (candidato.status !== 'ACTIVE') continue;

      const { valid, mustRehash } = await this.passwords.verify(
        {
          hash: candidato.passwordHash,
          algo: candidato.passwordAlgo,
          legacySalt: candidato.legacyPasswordSalt,
        },
        dto.password,
      );

      if (valid) autenticados.push({ user: candidato, mustRehash });
    }

    if (autenticados.length === 0) {
      // O e-mail identifica a tentativa; a senha jamais entra na trilha.
      await this.audit.record({
        action: AuditAction.LOGIN_FAILED,
        entityType: 'User',
        // Quando o e-mail não existe em conta nenhuma, não há autor a atribuir —
        // e é exatamente esse evento que interessa a quem investiga um ataque.
        accountId: candidatos[0]?.accountId,
        actorUserId: candidatos.length === 1 ? candidatos[0].id : undefined,
        reason: `e-mail: ${normalizaEmail(dto.email)}`,
        ipAddress: context.ipAddress,
        userAgent: context.userAgent,
      });

      throw new UnauthorizedException(CREDENCIAIS_INVALIDAS);
    }

    // A senha vale em mais de uma consultoria. A lista só chega aqui porque a
    // senha já bateu — antes disso ela seria um oráculo (D16).
    if (autenticados.length > 1) {
      throw new AccountSelectionRequiredException(
        autenticados.map(({ user }) => ({ id: user.account.id, name: user.account.name })),
      );
    }

    const { user, mustRehash } = autenticados[0];

    await this.prisma.user.update({
      where: { id: user.id },
      data: {
        lastAccessAt: new Date(),
        // O hash legado é aceito uma vez só: se continuasse valendo amanhã, a
        // migração de senhas nunca terminaria (D3).
        ...(mustRehash ? await this.reescreveSenha(dto.password) : {}),
      },
    });

    if (mustRehash) {
      await this.audit.record({
        action: AuditAction.PASSWORD_REHASHED,
        entityType: 'User',
        entityId: user.id,
        accountId: user.accountId,
        actorUserId: user.id,
        reason: 'hash legado reescrito em Argon2id no primeiro login',
      });
    }

    const tokens = await this.tokens.issuePair(
      { id: user.id, accountId: user.accountId },
      context,
    );

    await this.audit.record({
      action: AuditAction.LOGIN,
      entityType: 'User',
      entityId: user.id,
      accountId: user.accountId,
      actorUserId: user.id,
      ipAddress: context.ipAddress,
      userAgent: context.userAgent,
    });

    return {
      accessToken: tokens.accessToken,
      refreshToken: tokens.refreshToken,
      expiresIn: tokens.expiresIn,
      session: await this.montaSessão(user, user.account),
    };
  }

  async refresh(refreshToken: string, context: SessionContext = {}): Promise<AuthResult> {
    const tokens = await this.tokens.rotate(refreshToken, context);
    const claims = this.tokens.verifyAccessToken(tokens.accessToken);

    return {
      accessToken: tokens.accessToken,
      refreshToken: tokens.refreshToken,
      expiresIn: tokens.expiresIn,
      session: await this.buildSession(claims.sub),
    };
  }

  async logout(refreshToken: string, context: SessionContext = {}): Promise<void> {
    const sessão = await this.tokens.revoke(refreshToken);

    if (sessão) {
      await this.audit.record({
        action: AuditAction.LOGOUT,
        entityType: 'User',
        entityId: sessão.userId,
        accountId: sessão.accountId,
        actorUserId: sessão.userId,
        ipAddress: context.ipAddress,
        userAgent: context.userAgent,
      });
    }
  }

  /** Quem é, de que conta, e com que vínculos ativos. */
  async buildSession(userId: string): Promise<SessionUser> {
    const user = (await this.prisma.user.findUniqueOrThrow({
      where: { id: userId },
      include: { account: true },
    })) as UsuárioComConta;

    return this.montaSessão(user, user.account);
  }

  /** O escopo de autorização de quem está na requisição. */
  async buildScope(userId: string): Promise<SessionScope> {
    const user = await this.prisma.user.findUniqueOrThrow({
      where: { id: userId },
      include: { memberships: true },
    });

    return {
      userId: user.id,
      accountId: user.accountId,
      memberships: user.memberships.map((m) => ({
        id: m.id,
        accountId: m.accountId,
        userId: m.userId,
        companyId: m.companyId,
        roles: m.roles,
        executorType: m.executorType ?? undefined,
        supplierId: m.supplierId ?? undefined,
        isActive: m.isActive,
      })),
    };
  }

  /**
   * Dispara a recuperação de senha.
   *
   * Responde a mesma coisa para e-mail existente e inexistente — e não é
   * formalidade: "não encontrei esse e-mail" confirma quem é cliente de quem.
   */
  async forgotPassword(email: string): Promise<ForgotPasswordResponse> {
    const usuários = await this.prisma.user.findMany({
      where: { email: normalizaEmail(email), status: 'ACTIVE' },
    });

    for (const user of usuários) {
      const token = randomBytes(32).toString('base64url');

      await this.prisma.passwordResetToken.create({
        data: {
          userId: user.id,
          tokenHash: digest(token),
          expiresAt: new Date(Date.now() + VALIDADE_DO_RESET_EM_MS),
        },
      });

      await this.audit.record({
        action: AuditAction.PASSWORD_RESET_REQUESTED,
        entityType: 'User',
        entityId: user.id,
        accountId: user.accountId,
        actorUserId: user.id,
      });

      // Um e-mail por conta em que a pessoa existe. O corpo não diz de qual
      // consultoria se trata — o mesmo motivo da resposta genérica abaixo.
      await this.mail.enviarRecuperacaoDeSenha({
        to: user.email,
        nome: user.name,
        link: `${this.config.get('APP_URL', { infer: true })}/reset-password?token=${encodeURIComponent(token)}`,
      });
    }

    return {
      message:
        'Se houver uma conta com esse e-mail, enviamos as instruções de redefinição.',
    };
  }

  /** Redefinir a senha derruba todas as sessões: se houve roubo, ele acaba aqui. */
  async resetPassword(token: string, novaSenha: string): Promise<void> {
    const guardado = await this.prisma.passwordResetToken.findUnique({
      where: { tokenHash: digest(token) },
    });

    if (!guardado || guardado.usedAt || guardado.expiresAt <= new Date()) {
      throw new BadRequestException('Token de redefinição inválido ou expirado.');
    }

    await this.prisma.$transaction([
      this.prisma.user.update({
        where: { id: guardado.userId },
        data: {
          passwordHash: await this.passwords.hash(novaSenha),
          passwordAlgo: 'ARGON2ID',
          legacyPasswordSalt: null,
        },
      }),
      this.prisma.passwordResetToken.update({
        where: { id: guardado.id },
        data: { usedAt: new Date() },
      }),
    ]);

    await this.tokens.revokeAllForUser(guardado.userId, 'senha-redefinida');

    await this.audit.record({
      action: AuditAction.PASSWORD_RESET,
      entityType: 'User',
      entityId: guardado.userId,
      actorUserId: guardado.userId,
      reason: 'todas as sessões ativas foram encerradas',
    });
  }

  private async reescreveSenha(senha: string): Promise<Prisma.UserUpdateInput> {
    return {
      passwordHash: await this.passwords.hash(senha),
      passwordAlgo: 'ARGON2ID',
      legacyPasswordSalt: null,
    };
  }

  private async montaSessão(user: UserRow, account: Account): Promise<SessionUser> {
    const [memberships, isPlatformAdmin] = await Promise.all([
      this.prisma.membership.findMany({
        where: { userId: user.id, isActive: true, accountId: user.accountId },
        include: { company: true },
      }),
      this.platformAdmins.isPlatformAdmin(user.id),
    ]);

    return {
      user: paraContratoDeUsuário(user),
      account: paraContratoDeConta(account),
      memberships: memberships.map(paraContratoDeVínculo),
      isPlatformAdmin,
    };
  }
}

function digest(token: string): string {
  return createHash('sha256').update(token).digest('hex');
}

function normalizaEmail(email: string): string {
  return email.trim().toLowerCase();
}

/**
 * As projeções abaixo são explícitas de propósito. Devolver a linha do banco
 * inteira funcionaria hoje e vazaria `passwordHash` no dia em que alguém
 * adicionasse um campo novo — listar campo a campo é o que torna o vazamento
 * impossível por omissão.
 */
function paraContratoDeUsuário(user: UserRow): UserContract {
  return {
    id: user.id,
    accountId: user.accountId,
    name: user.name,
    email: user.email,
    phone: user.phone ?? undefined,
    registryType: user.registryType ?? undefined,
    registryNumber: user.registryNumber ?? undefined,
    jobTitle: user.jobTitle ?? undefined,
    invitedByUserId: user.invitedByUserId ?? undefined,
    status: user.status,
    disabledAt: user.disabledAt?.toISOString(),
    succeededByUserId: user.succeededByUserId ?? undefined,
    lastAccessAt: user.lastAccessAt?.toISOString(),
  };
}

function paraContratoDeConta(account: Account): AccountContract {
  return {
    id: account.id,
    name: account.name,
    document: account.document,
    ownerUserId: account.ownerUserId ?? undefined,
    status: account.status,
  };
}

function paraContratoDeVínculo(
  m: Membership & { company: { id: string; tradeName: string; corporateName: string; isActive: boolean } },
): MembershipWithCompany {
  return {
    id: m.id,
    accountId: m.accountId,
    userId: m.userId,
    companyId: m.companyId,
    roles: m.roles,
    executorType: m.executorType ?? undefined,
    supplierId: m.supplierId ?? undefined,
    isActive: m.isActive,
    company: {
      id: m.company.id,
      tradeName: m.company.tradeName,
      corporateName: m.company.corporateName,
      isActive: m.company.isActive,
    },
  };
}
