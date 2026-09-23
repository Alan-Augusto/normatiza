import { ForbiddenException, Injectable } from '@nestjs/common';

import { PrismaService } from '../prisma/prisma.service';

/**
 * Empresa inativa é modo leitura (docs/produto/01 §5). Uma pergunta só, feita
 * por toda mutação que recebe `companyId` — convite, vínculo, cadastro e, com
 * as próximas features, equipamento, análise e plano de ação.
 *
 * Quem recusa é o servidor. A tela esconde os botões, mas um botão escondido é
 * conveniência; a trava é esta.
 */
@Injectable()
export class CompanyWriteGuard {
  constructor(private readonly prisma: PrismaService) {}

  async assertWritable(accountId: string, companyIds: string[]): Promise<void> {
    if (companyIds.length === 0) return;

    const inativa = await this.prisma.company.findFirst({
      where: { accountId, id: { in: companyIds }, deactivatedAt: { not: null } },
      select: { tradeName: true },
    });

    if (inativa) {
      throw new ForbiddenException(
        `A ${inativa.tradeName} está inativa e em modo leitura. Reative a empresa para fazer alterações.`,
      );
    }
  }
}
