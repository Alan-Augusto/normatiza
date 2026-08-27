import { UnauthorizedException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';

import { AccountSelectionRequiredException } from './account-selection-required.exception';
import { AuthService, CREDENCIAIS_INVALIDAS } from './auth.service';
import { PasswordService } from './password.service';
import { TokenService } from './token.service';
import { AuditService } from '../audit/audit.service';
import { EnvironmentVariables } from '../config/env.validation';
import { MailService } from '../mail/mail.service';
import { PlatformAdminService } from '../platform/platform-admin.service';
import { PrismaService } from '../prisma/prisma.service';

/**
 * O banco é falso aqui de propósito: o que estes testes verificam é a **decisão**
 * do login — quem entra, quem é recusado e o que é dito a quem é recusado. O
 * comportamento contra banco real está na suíte e2e.
 */
function fakePrisma() {
  return {
    user: { findMany: jest.fn(), update: jest.fn().mockResolvedValue({}) },
    account: { findUnique: jest.fn() },
    membership: { findMany: jest.fn().mockResolvedValue([]) },
  } as unknown as PrismaService & {
    user: { findMany: jest.Mock; update: jest.Mock };
    account: { findUnique: jest.Mock };
    membership: { findMany: jest.Mock };
  };
}

const CONTA_NORMATIZA = { id: 'acc-1', name: 'Normatiza', document: '1', status: 'ACTIVE' };
const CONTA_RIVAL = { id: 'acc-2', name: 'Consultoria Rival', document: '2', status: 'ACTIVE' };

function usuário(over: Partial<Record<string, unknown>> = {}) {
  return {
    id: 'u-1',
    accountId: CONTA_NORMATIZA.id,
    name: 'Marcos',
    email: 'marcos@brf.com',
    status: 'ACTIVE',
    passwordHash: 'hash-argon2id',
    passwordAlgo: 'ARGON2ID',
    legacyPasswordSalt: null,
    account: CONTA_NORMATIZA,
    ...over,
  };
}

describe('AuthService — login', () => {
  let prisma: ReturnType<typeof fakePrisma>;
  let passwords: jest.Mocked<PasswordService>;
  let tokens: jest.Mocked<TokenService>;
  let service: AuthService;

  const sessãoEmitida = {
    accessToken: 'access.jwt',
    refreshToken: 'refresh-em-claro',
    expiresIn: 900,
  };

  beforeEach(() => {
    prisma = fakePrisma();
    passwords = {
      hash: jest.fn().mockResolvedValue('novo-hash-argon2id'),
      verify: jest.fn(),
    } as unknown as jest.Mocked<PasswordService>;
    tokens = {
      issuePair: jest.fn().mockResolvedValue(sessãoEmitida),
    } as unknown as jest.Mocked<TokenService>;

    // A auditoria é registrada, não decidida aqui: o que ela grava está coberto
    // por `test/audit.e2e-spec.ts`, contra o banco real.
    const audit = { record: jest.fn() } as unknown as AuditService;

    // O acesso ao Contexto 0 é ortogonal ao login: quem entra, entra igual,
    // sendo admin da plataforma ou não. O comportamento dele está em
    // `platform-admin.service.spec.ts` e em `test/platform-admin.e2e-spec.ts`.
    const platformAdmins = {
      isPlatformAdmin: jest.fn().mockResolvedValue(false),
    } as unknown as PlatformAdminService;

    // O envio de e-mail é efeito colateral do fluxo de senha, não decisão do
    // login. O que a trava de envio permite está em `mail.service.spec.ts`.
    const mail = {
      enviarConvite: jest.fn(),
      enviarRecuperacaoDeSenha: jest.fn(),
    } as unknown as MailService;
    const config = { get: () => 'http://localhost:8080' } as unknown as ConfigService<
      EnvironmentVariables,
      true
    >;

    service = new AuthService(prisma, passwords, tokens, audit, platformAdmins, mail, config);
  });

  const senhaConfere = () => passwords.verify.mockResolvedValue({ valid: true, mustRehash: false });
  const senhaNãoConfere = () => passwords.verify.mockResolvedValue({ valid: false, mustRehash: false });

  describe('o caminho normal', () => {
    it('deve autenticar quem informa credenciais válidas', async () => {
      prisma.user.findMany.mockResolvedValue([usuário()]);
      senhaConfere();

      const resposta = await service.login({ email: 'marcos@brf.com', password: 'certa' });

      expect(resposta.accessToken).toBe(sessãoEmitida.accessToken);
      expect(resposta.expiresIn).toBeGreaterThan(0);
    });

    it('deve registrar o último acesso de quem entrou', async () => {
      prisma.user.findMany.mockResolvedValue([usuário()]);
      senhaConfere();

      await service.login({ email: 'marcos@brf.com', password: 'certa' });

      expect(prisma.user.update).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { id: 'u-1' },
          data: expect.objectContaining({ lastAccessAt: expect.any(Date) }),
        }),
      );
    });
  });

  describe('recusas — todas indistinguíveis entre si', () => {
    it('deve recusar e-mail que não existe', async () => {
      prisma.user.findMany.mockResolvedValue([]);

      await expect(service.login({ email: 'ninguem@brf.com', password: 'x' })).rejects.toThrow(
        new UnauthorizedException(CREDENCIAIS_INVALIDAS),
      );
    });

    it('deve recusar senha errada com a mesma mensagem de e-mail inexistente', async () => {
      prisma.user.findMany.mockResolvedValue([usuário()]);
      senhaNãoConfere();

      await expect(service.login({ email: 'marcos@brf.com', password: 'errada' })).rejects.toThrow(
        new UnauthorizedException(CREDENCIAIS_INVALIDAS),
      );
    });

    it('deve recusar usuário desligado mesmo com a senha correta', async () => {
      prisma.user.findMany.mockResolvedValue([usuário({ status: 'DISABLED' })]);
      senhaConfere();

      await expect(service.login({ email: 'marcos@brf.com', password: 'certa' })).rejects.toThrow(
        new UnauthorizedException(CREDENCIAIS_INVALIDAS),
      );
    });

    it('deve recusar quem foi convidado e ainda não definiu senha', async () => {
      prisma.user.findMany.mockResolvedValue([
        usuário({ status: 'INVITED', passwordHash: null, passwordAlgo: null }),
      ]);
      senhaNãoConfere();

      await expect(service.login({ email: 'marcos@brf.com', password: 'chute' })).rejects.toThrow(
        new UnauthorizedException(CREDENCIAIS_INVALIDAS),
      );
    });

    it('não deve emitir sessão para quem foi recusado', async () => {
      prisma.user.findMany.mockResolvedValue([usuário({ status: 'DISABLED' })]);
      senhaConfere();

      await expect(service.login({ email: 'marcos@brf.com', password: 'certa' })).rejects.toThrow();
      expect(tokens.issuePair).not.toHaveBeenCalled();
    });
  });

  describe('senha herdada do sistema legado', () => {
    const migrado = () =>
      usuário({
        passwordHash: 'sha256-do-legado',
        passwordAlgo: 'LEGACY_SHA256',
        legacyPasswordSalt: 'c2FsdA==',
      });

    it('deve deixar entrar quem ainda tem a senha do sistema antigo', async () => {
      prisma.user.findMany.mockResolvedValue([migrado()]);
      passwords.verify.mockResolvedValue({ valid: true, mustRehash: true });

      const resposta = await service.login({ email: 'marcos@brf.com', password: 'antiga' });

      expect(resposta.accessToken).toBe(sessãoEmitida.accessToken);
    });

    it('deve reescrever a senha em Argon2id no mesmo login e descartar o salt antigo', async () => {
      // O hash legado é aceito uma vez só. Se o usuário voltasse a autenticar
      // pelo SHA-256 amanhã, a migração nunca terminaria.
      prisma.user.findMany.mockResolvedValue([migrado()]);
      passwords.verify.mockResolvedValue({ valid: true, mustRehash: true });

      await service.login({ email: 'marcos@brf.com', password: 'antiga' });

      expect(prisma.user.update).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { id: 'u-1' },
          data: expect.objectContaining({
            passwordHash: 'novo-hash-argon2id',
            passwordAlgo: 'ARGON2ID',
            legacyPasswordSalt: null,
          }),
        }),
      );
    });

    it('não deve reescrever a senha de quem errou a senha antiga', async () => {
      prisma.user.findMany.mockResolvedValue([migrado()]);
      senhaNãoConfere();

      await expect(service.login({ email: 'marcos@brf.com', password: 'chute' })).rejects.toThrow();
      expect(passwords.hash).not.toHaveBeenCalled();
    });
  });

  describe('o mesmo e-mail em duas consultorias (D16)', () => {
    const naNormatiza = () =>
      usuário({ id: 'u-a', accountId: 'acc-1', account: CONTA_NORMATIZA, passwordHash: 'hash-normatiza' });
    const naRival = () =>
      usuário({ id: 'u-b', accountId: 'acc-2', account: CONTA_RIVAL, passwordHash: 'hash-rival' });

    it('deve entrar direto quando a senha vale em apenas uma delas', async () => {
      // O caso realista: senhas diferentes em cada consultoria. Ninguém escolhe nada.
      prisma.user.findMany.mockResolvedValue([naNormatiza(), naRival()]);
      passwords.verify.mockImplementation(async (stored) => ({
        valid: stored.hash === 'hash-normatiza',
        mustRehash: false,
      }));

      const resposta = await service.login({ email: 'paulo@ipe.com', password: 'so-da-normatiza' });

      expect(resposta.accessToken).toBe(sessãoEmitida.accessToken);
      expect(tokens.issuePair).toHaveBeenCalledWith(
        expect.objectContaining({ id: 'u-a' }),
        expect.anything(),
      );
    });

    it('deve pedir a consultoria quando a senha vale nas duas', async () => {
      prisma.user.findMany.mockResolvedValue([naNormatiza(), naRival()]);
      senhaConfere();

      await expect(
        service.login({ email: 'paulo@ipe.com', password: 'mesma-senha' }),
      ).rejects.toBeInstanceOf(AccountSelectionRequiredException);
    });

    it('deve oferecer as consultorias pelo nome, para a pessoa reconhecer qual é', async () => {
      prisma.user.findMany.mockResolvedValue([naNormatiza(), naRival()]);
      senhaConfere();

      const erro: AccountSelectionRequiredException = await service
        .login({ email: 'paulo@ipe.com', password: 'mesma-senha' })
        .then(() => {
          throw new Error('deveria ter pedido a escolha da consultoria');
        })
        .catch((e) => e);

      expect(erro.getResponse()).toEqual({
        reason: 'ACCOUNT_SELECTION_REQUIRED',
        accounts: [
          { id: 'acc-1', name: 'Normatiza' },
          { id: 'acc-2', name: 'Consultoria Rival' },
        ],
      });
    });

    it('não deve revelar as consultorias para quem errou a senha', async () => {
      // A lista só existe depois que a senha bateu. Antes disso, o login viraria
      // um oráculo de quem é cliente de quem.
      prisma.user.findMany.mockResolvedValue([naNormatiza(), naRival()]);
      senhaNãoConfere();

      await expect(
        service.login({ email: 'paulo@ipe.com', password: 'chute' }),
      ).rejects.toThrow(new UnauthorizedException(CREDENCIAIS_INVALIDAS));
    });

    it('deve autenticar na consultoria escolhida quando ela é informada', async () => {
      prisma.user.findMany.mockResolvedValue([naNormatiza(), naRival()]);
      senhaConfere();

      const resposta = await service.login({
        email: 'paulo@ipe.com',
        password: 'mesma-senha',
        accountId: 'acc-2',
      });

      expect(resposta.accessToken).toBe(sessãoEmitida.accessToken);
      expect(tokens.issuePair).toHaveBeenCalledWith(
        expect.objectContaining({ id: 'u-b', accountId: 'acc-2' }),
        expect.anything(),
      );
    });

    it('deve recusar consultoria informada em que a pessoa não tem acesso', async () => {
      prisma.user.findMany.mockResolvedValue([naNormatiza(), naRival()]);
      senhaConfere();

      await expect(
        service.login({ email: 'paulo@ipe.com', password: 'mesma-senha', accountId: 'acc-999' }),
      ).rejects.toThrow(new UnauthorizedException(CREDENCIAIS_INVALIDAS));
    });
  });
});
