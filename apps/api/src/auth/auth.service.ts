import { Injectable } from '@nestjs/common';
import type { LoginRequest, LoginResponse, SessionUser } from '@normatiza/shared';

import { PasswordService } from './password.service';
import { SessionContext, TokenService } from './token.service';
import { PrismaService } from '../prisma/prisma.service';

/**
 * Mensagem única para toda falha de autenticação — e-mail inexistente, senha
 * errada, usuário desligado, convite ainda não aceito. Uma mensagem específica
 * para cada caso seria um oráculo de quem existe no sistema.
 */
export const CREDENCIAIS_INVALIDAS = 'E-mail ou senha inválidos.';

@Injectable()
export class AuthService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly passwords: PasswordService,
    private readonly tokens: TokenService,
  ) {}

  /**
   * Autentica por e-mail e senha.
   *
   * Recusa de e-mail inexistente e de senha errada são **indistinguíveis** —
   * mesma mensagem, mesmo status. Dizer "esse e-mail não existe" é confirmar
   * quem é cliente de quem.
   */
  login(_dto: LoginRequest, _context?: SessionContext): Promise<LoginResponse> {
    throw new Error('AuthService.login não implementado');
  }

  refresh(_refreshToken: string, _context?: SessionContext): Promise<LoginResponse> {
    throw new Error('AuthService.refresh não implementado');
  }

  logout(_refreshToken: string): Promise<void> {
    throw new Error('AuthService.logout não implementado');
  }

  /** Quem é, de que conta, e com que vínculos ativos. */
  buildSession(_userId: string): Promise<SessionUser> {
    throw new Error('AuthService.buildSession não implementado');
  }
}
