import { ExecutionContext, ForbiddenException, UnauthorizedException } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import type { Membership, Role } from '@normatiza/shared';

import { PermissionService, SessionScope } from './permission.service';
import { RolesGuard } from './roles.guard';

const BRF = 'brf';
const SEARA = 'seara';

function vínculo(companyId: string, roles: Role[]): Membership {
  return {
    id: `m-${companyId}`,
    accountId: 'acc-1',
    userId: 'u-1',
    companyId,
    roles,
    isActive: true,
  } as Membership;
}

/** Uma requisição já autenticada, opcionalmente mirando uma empresa. */
function requisição(companyId?: string) {
  return {
    auth: { userId: 'u-1', accountId: 'acc-1' },
    params: companyId ? { companyId } : {},
    body: {},
  };
}

function contexto(req: unknown): ExecutionContext {
  return {
    switchToHttp: () => ({ getRequest: () => req }),
    getHandler: () => ({}),
    getClass: () => ({}),
  } as unknown as ExecutionContext;
}

describe('RolesGuard', () => {
  let guard: RolesGuard;
  let reflector: Reflector;
  let escopoDoUsuário: SessionScope;

  const exigindo = (...roles: Role[]) =>
    jest.spyOn(reflector, 'getAllAndOverride').mockReturnValue(roles);

  beforeEach(() => {
    reflector = new Reflector();
    escopoDoUsuário = {
      userId: 'u-1',
      accountId: 'acc-1',
      memberships: [vínculo(BRF, ['MANAGER'])],
    };

    const auth = { buildScope: jest.fn(async () => escopoDoUsuário) };

    guard = new RolesGuard(reflector, new PermissionService(), auth as never);
  });

  it('deve liberar rota que não exige papel nenhum', async () => {
    jest.spyOn(reflector, 'getAllAndOverride').mockReturnValue(undefined);

    await expect(guard.canActivate(contexto(requisição()))).resolves.toBe(true);
  });

  it('deve recusar requisição sem autenticação', async () => {
    exigindo('MANAGER');

    await expect(guard.canActivate(contexto({ params: {}, body: {} }))).rejects.toThrow(
      UnauthorizedException,
    );
  });

  it('deve liberar quem tem o papel exigido', async () => {
    exigindo('MANAGER');

    await expect(guard.canActivate(contexto(requisição()))).resolves.toBe(true);
  });

  it('deve liberar quem tem ao menos um dos papéis exigidos', async () => {
    exigindo('LEAD_ENGINEER', 'MANAGER');

    await expect(guard.canActivate(contexto(requisição()))).resolves.toBe(true);
  });

  it('deve recusar quem não tem o papel exigido', async () => {
    // Aprovar orçamento é exclusivo do Gestor; o Engenheiro do Cliente não passa.
    escopoDoUsuário.memberships = [vínculo(BRF, ['CLIENT_ENGINEER'])];
    exigindo('MANAGER');

    await expect(guard.canActivate(contexto(requisição()))).rejects.toThrow(ForbiddenException);
  });

  describe('quando a rota mira uma empresa', () => {
    it('deve exigir o papel naquela empresa, e não em qualquer uma', async () => {
      // Ser Gestor da BRF não autoriza agir na Seara.
      exigindo('MANAGER');

      await expect(guard.canActivate(contexto(requisição(SEARA)))).rejects.toThrow(
        ForbiddenException,
      );
    });

    it('deve liberar quando o papel está na empresa mirada', async () => {
      exigindo('MANAGER');

      await expect(guard.canActivate(contexto(requisição(BRF)))).resolves.toBe(true);
    });

    it('deve recusar empresa fora do escopo mesmo com o papel em outra', async () => {
      escopoDoUsuário.memberships = [
        vínculo(BRF, ['CONSULTANT_ENGINEER']),
        vínculo(SEARA, ['TECHNICIAN']),
      ];
      exigindo('CONSULTANT_ENGINEER');

      await expect(guard.canActivate(contexto(requisição(SEARA)))).rejects.toThrow(
        ForbiddenException,
      );
    });
  });
});
