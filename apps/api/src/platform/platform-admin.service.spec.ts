import { ForbiddenException, NotFoundException } from '@nestjs/common';

import { PlatformAdminService } from './platform-admin.service';
import { AuditService } from '../audit/audit.service';
import { PrismaService } from '../prisma/prisma.service';

/**
 * O acesso ao Contexto 0. O que estes testes fixam é **quem entra, quem
 * concede e o que fica registrado** — não como a consulta é escrita.
 */
function fakePrisma() {
  return {
    platformAdmin: {
      findUnique: jest.fn(),
      findMany: jest.fn().mockResolvedValue([]),
      upsert: jest.fn().mockResolvedValue({}),
      update: jest.fn().mockResolvedValue({}),
    },
    user: { findUnique: jest.fn() },
  } as unknown as PrismaService & {
    platformAdmin: {
      findUnique: jest.Mock;
      findMany: jest.Mock;
      upsert: jest.Mock;
      update: jest.Mock;
    };
    user: { findUnique: jest.Mock };
  };
}

const ATIVO = { id: 'pa-1', userId: 'u-josue', grantedByUserId: null, revokedAt: null };
const REVOGADO = { ...ATIVO, revokedAt: new Date('2026-01-01') };

describe('PlatformAdminService', () => {
  let prisma: ReturnType<typeof fakePrisma>;
  let audit: { record: jest.Mock };
  let service: PlatformAdminService;

  beforeEach(() => {
    prisma = fakePrisma();
    audit = { record: jest.fn() };
    service = new PlatformAdminService(prisma, audit as unknown as AuditService);
  });

  describe('quem é admin da plataforma', () => {
    it('deve reconhecer quem tem concessão ativa', async () => {
      prisma.platformAdmin.findUnique.mockResolvedValue(ATIVO);
      await expect(service.isPlatformAdmin('u-josue')).resolves.toBe(true);
    });

    it('não deve reconhecer quem nunca teve concessão', async () => {
      prisma.platformAdmin.findUnique.mockResolvedValue(null);
      await expect(service.isPlatformAdmin('u-marcos')).resolves.toBe(false);
    });

    it('não deve reconhecer quem teve a concessão revogada', async () => {
      // A linha continua existindo de propósito: apagá-la apagaria o fato de o
      // acesso ter existido, que é o que uma auditoria procura.
      prisma.platformAdmin.findUnique.mockResolvedValue(REVOGADO);
      await expect(service.isPlatformAdmin('u-josue')).resolves.toBe(false);
    });

    it('não deve reconhecer usuário desligado, ainda que a concessão esteja de pé', async () => {
      // Desligar a pessoa precisa fechar todas as portas de uma vez. Se o
      // Contexto 0 sobrevivesse ao desligamento, tirar o acesso de alguém
      // exigiria lembrar de dois lugares — e um dia alguém esquece.
      prisma.platformAdmin.findUnique.mockResolvedValue({
        ...ATIVO,
        user: { status: 'DISABLED' },
      });
      await expect(service.isPlatformAdmin('u-josue')).resolves.toBe(false);
    });
  });

  describe('conceder', () => {
    it('deve registrar quem concedeu', async () => {
      prisma.user.findUnique.mockResolvedValue({ id: 'u-novo', status: 'ACTIVE' });
      prisma.platformAdmin.findUnique.mockResolvedValue(ATIVO);

      await service.grant('u-novo', 'u-josue');

      expect(prisma.platformAdmin.upsert).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { userId: 'u-novo' },
          create: expect.objectContaining({ userId: 'u-novo', grantedByUserId: 'u-josue' }),
        }),
      );
    });

    it('deve deixar a concessão em trilha de auditoria', async () => {
      prisma.user.findUnique.mockResolvedValue({ id: 'u-novo', status: 'ACTIVE' });
      prisma.platformAdmin.findUnique.mockResolvedValue(ATIVO);

      await service.grant('u-novo', 'u-josue');

      expect(audit.record).toHaveBeenCalledWith(
        expect.objectContaining({
          action: 'platform_admin.granted',
          entityId: 'u-novo',
          actorUserId: 'u-josue',
        }),
      );
    });

    it('deve recusar quem não é admin da plataforma', async () => {
      // Só admin faz admin. Se um Engenheiro Responsável pudesse conceder, o
      // teto de papel — hoje uma tabela fechada — ganharia uma aresta para o topo.
      prisma.user.findUnique.mockResolvedValue({ id: 'u-novo', status: 'ACTIVE' });
      prisma.platformAdmin.findUnique.mockResolvedValue(null);

      await expect(service.grant('u-novo', 'u-marcos')).rejects.toBeInstanceOf(ForbiddenException);
      expect(prisma.platformAdmin.upsert).not.toHaveBeenCalled();
    });

    it('deve recusar usuário que não existe', async () => {
      prisma.platformAdmin.findUnique.mockResolvedValue(ATIVO);
      prisma.user.findUnique.mockResolvedValue(null);

      await expect(service.grant('u-fantasma', 'u-josue')).rejects.toBeInstanceOf(
        NotFoundException,
      );
    });

    it('deve reativar concessão revogada em vez de duplicar', async () => {
      // `userId` é único: uma segunda linha nem seria possível. O que importa é
      // que reconceder limpe o `revokedAt` e volte a valer.
      prisma.user.findUnique.mockResolvedValue({ id: 'u-josue', status: 'ACTIVE' });
      prisma.platformAdmin.findUnique.mockResolvedValue(ATIVO);

      await service.grant('u-josue', 'u-josue');

      expect(prisma.platformAdmin.upsert).toHaveBeenCalledWith(
        expect.objectContaining({ update: expect.objectContaining({ revokedAt: null }) }),
      );
    });
  });

  describe('revogar', () => {
    it('deve marcar a revogação sem apagar a linha', async () => {
      prisma.platformAdmin.findUnique.mockResolvedValue(ATIVO);

      await service.revoke('u-outro', 'u-josue');

      expect(prisma.platformAdmin.update).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { userId: 'u-outro' },
          data: expect.objectContaining({ revokedAt: expect.any(Date) }),
        }),
      );
    });

    it('deve deixar a revogação em trilha de auditoria', async () => {
      prisma.platformAdmin.findUnique.mockResolvedValue(ATIVO);

      await service.revoke('u-outro', 'u-josue');

      expect(audit.record).toHaveBeenCalledWith(
        expect.objectContaining({
          action: 'platform_admin.revoked',
          entityId: 'u-outro',
          actorUserId: 'u-josue',
        }),
      );
    });

    it('deve impedir que o admin revogue a si mesmo', async () => {
      // Um sistema sem nenhum admin exige acesso ao banco para se recuperar.
      // Barrar a auto-revogação não resolve tudo, mas remove o jeito mais fácil
      // de trancar a própria porta por engano.
      prisma.platformAdmin.findUnique.mockResolvedValue(ATIVO);

      await expect(service.revoke('u-josue', 'u-josue')).rejects.toBeInstanceOf(
        ForbiddenException,
      );
      expect(prisma.platformAdmin.update).not.toHaveBeenCalled();
    });

    it('deve recusar quem não é admin da plataforma', async () => {
      prisma.platformAdmin.findUnique.mockResolvedValue(null);

      await expect(service.revoke('u-outro', 'u-marcos')).rejects.toBeInstanceOf(
        ForbiddenException,
      );
    });
  });
});
