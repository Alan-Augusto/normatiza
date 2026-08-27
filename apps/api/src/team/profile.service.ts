import { Injectable } from '@nestjs/common';
import type { ChangePasswordRequest, UpdateProfileRequest } from '@normatiza/shared';

import { AuditService } from '../audit/audit.service';
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
    throw new Error('não implementado');
  }

  /**
   * Troca a própria senha.
   *
   * Exige a senha atual mesmo havendo sessão válida: uma aba esquecida aberta
   * não pode bastar para trocar a credencial permanente.
   */
  async changePassword(userId: string, dto: ChangePasswordRequest): Promise<void> {
    throw new Error('não implementado');
  }
}
