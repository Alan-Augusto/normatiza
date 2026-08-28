import { BadRequestException, ForbiddenException, NotFoundException } from '@nestjs/common';

import { PlatformAdminService } from './platform-admin.service';
import { UserSelectionRequiredException } from './user-selection-required.exception';
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
    user: { findMany: jest.fn().mockResolvedValue([]) },
  } as unknown as PrismaService & {
    platformAdmin: {
      findUnique: jest.Mock;
      findMany: jest.Mock;
      upsert: jest.Mock;
      update: jest.Mock;
    };
    user: { findMany: jest.Mock };
  };
}

/** Uma pessoa alcançada pelo e-mail, já com a conta a que ela pertence. */
const pessoa = (over: Record<string, unknown> = {}) => ({
  id: 'u-novo',
  name: 'Beatriz',
  email: 'beatriz@normatiza.com',
  status: 'ACTIVE',
  account: { name: 'Normatiza' },
  ...over,
});

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
    /** Quem concede é admin, salvo quando o teste disser o contrário. */
    beforeEach(() => prisma.platformAdmin.findUnique.mockResolvedValue(ATIVO));

    it('deve registrar quem concedeu', async () => {
      prisma.user.findMany.mockResolvedValue([pessoa()]);

      await service.grant({ email: 'beatriz@normatiza.com' }, 'u-josue');

      expect(prisma.platformAdmin.upsert).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { userId: 'u-novo' },
          create: expect.objectContaining({ userId: 'u-novo', grantedByUserId: 'u-josue' }),
        }),
      );
    });

    it('deve deixar a concessão em trilha de auditoria', async () => {
      prisma.user.findMany.mockResolvedValue([pessoa()]);

      await service.grant({ email: 'beatriz@normatiza.com' }, 'u-josue');

      expect(audit.record).toHaveBeenCalledWith(
        expect.objectContaining({
          action: 'platform_admin.granted',
          entityId: 'u-novo',
          actorUserId: 'u-josue',
        }),
      );
    });

    it('deve procurar pelo e-mail normalizado', async () => {
      // Copiar e colar traz espaço e maiúscula junto. Um e-mail que não casa
      // por causa disso responde "nenhum usuário com esse e-mail" — a mensagem
      // mais enganosa possível, porque a pessoa está olhando para o endereço
      // certo enquanto lê que ele não existe.
      prisma.user.findMany.mockResolvedValue([pessoa()]);

      await service.grant({ email: '  Beatriz@Normatiza.com ' }, 'u-josue');

      expect(prisma.user.findMany).toHaveBeenCalledWith(
        expect.objectContaining({ where: { email: 'beatriz@normatiza.com' } }),
      );
    });

    it('deve recusar quem não é admin da plataforma', async () => {
      // Só admin faz admin. Se um Engenheiro Responsável pudesse conceder, o
      // teto de papel — hoje uma tabela fechada — ganharia uma aresta para o topo.
      prisma.platformAdmin.findUnique.mockResolvedValue(null);
      prisma.user.findMany.mockResolvedValue([pessoa()]);

      await expect(
        service.grant({ email: 'beatriz@normatiza.com' }, 'u-marcos'),
      ).rejects.toBeInstanceOf(ForbiddenException);
      expect(prisma.platformAdmin.upsert).not.toHaveBeenCalled();
    });

    it('deve dizer que não há ninguém com esse e-mail', async () => {
      // Aqui a recusa pode ser específica: quem pergunta é o Contexto 0, e não
      // há inquilino nenhum a proteger dele. Um "erro genérico" só faria a
      // pessoa reler um e-mail que estava certo.
      prisma.user.findMany.mockResolvedValue([]);

      await expect(service.grant({ email: 'ninguem@lugar.com' }, 'u-josue')).rejects.toBeInstanceOf(
        NotFoundException,
      );
      expect(prisma.platformAdmin.upsert).not.toHaveBeenCalled();
    });

    it('deve pedir a escolha quando o e-mail alcança mais de uma pessoa', async () => {
      // `User.email` é único por conta, não globalmente: o mesmo endereço pode
      // ser duas pessoas em duas consultorias. Promover "a primeira que
      // aparecer" daria acesso total à pessoa errada, em silêncio.
      prisma.user.findMany.mockResolvedValue([
        pessoa({ id: 'u-a', account: { name: 'Normatiza' } }),
        pessoa({ id: 'u-b', account: { name: 'Outra Consultoria' } }),
      ]);

      await expect(
        service.grant({ email: 'beatriz@normatiza.com' }, 'u-josue'),
      ).rejects.toBeInstanceOf(UserSelectionRequiredException);
      expect(prisma.platformAdmin.upsert).not.toHaveBeenCalled();
    });

    it('deve nomear as contas dos candidatos, para haver como escolher', async () => {
      prisma.user.findMany.mockResolvedValue([
        pessoa({ id: 'u-a', account: { name: 'Normatiza' } }),
        pessoa({ id: 'u-b', account: { name: 'Outra Consultoria' } }),
      ]);

      const falha = await service
        .grant({ email: 'beatriz@normatiza.com' }, 'u-josue')
        .catch((e: UserSelectionRequiredException) => e);

      expect((falha as UserSelectionRequiredException).getResponse()).toMatchObject({
        candidates: [
          { userId: 'u-a', accountName: 'Normatiza' },
          { userId: 'u-b', accountName: 'Outra Consultoria' },
        ],
      });
    });

    it('deve conceder à pessoa escolhida no desempate', async () => {
      prisma.user.findMany.mockResolvedValue([pessoa({ id: 'u-a' }), pessoa({ id: 'u-b' })]);

      await service.grant({ email: 'beatriz@normatiza.com', userId: 'u-b' }, 'u-josue');

      expect(prisma.platformAdmin.upsert).toHaveBeenCalledWith(
        expect.objectContaining({ where: { userId: 'u-b' } }),
      );
    });

    it('não deve promover um id que não pertence àquele e-mail', async () => {
      // Sem esta conferência, `userId` viraria um jeito de promover qualquer
      // linha do banco passando um e-mail qualquer que exista.
      prisma.user.findMany.mockResolvedValue([pessoa({ id: 'u-a' })]);

      await expect(
        service.grant({ email: 'beatriz@normatiza.com', userId: 'u-outro-qualquer' }, 'u-josue'),
      ).rejects.toBeInstanceOf(NotFoundException);
      expect(prisma.platformAdmin.upsert).not.toHaveBeenCalled();
    });

    it('deve recusar quem está desligado, em vez de gravar acesso que não vale', async () => {
      // `isPlatformAdmin` já recusa quem está `DISABLED`. Conceder assim mesmo
      // gravaria uma linha inerte, e quem concedeu sairia achando que deu.
      prisma.user.findMany.mockResolvedValue([pessoa({ status: 'DISABLED' })]);

      await expect(
        service.grant({ email: 'beatriz@normatiza.com' }, 'u-josue'),
      ).rejects.toBeInstanceOf(BadRequestException);
      expect(prisma.platformAdmin.upsert).not.toHaveBeenCalled();
    });

    it('deve reativar concessão revogada em vez de duplicar', async () => {
      // `userId` é único: uma segunda linha nem seria possível. O que importa é
      // que reconceder limpe o `revokedAt` e volte a valer.
      prisma.user.findMany.mockResolvedValue([pessoa({ id: 'u-josue' })]);

      await service.grant({ email: 'josue@normatiza.com' }, 'u-josue');

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
