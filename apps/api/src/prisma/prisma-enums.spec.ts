import { Role as PrismaRole, ExecutorType, UserStatus, AccountStatus } from '@prisma/client';
import { ROLE_SIDE } from '@normatiza/shared';

/**
 * O banco e o contrato de rede declaram os mesmos conjuntos em lugares
 * diferentes — o `schema.prisma` e o `packages/shared`. Nada impede que um mude
 * sem o outro, exceto este teste.
 */
describe('Enums do banco e contratos compartilhados', () => {
  it('deve declarar exatamente os mesmos oito papéis no banco e no contrato', () => {
    const noBanco = Object.values(PrismaRole).sort();
    const noContrato = Object.keys(ROLE_SIDE).sort();

    expect(noBanco).toEqual(noContrato);
    expect(noBanco).toHaveLength(8);
  });

  it('deve manter os demais enums de identidade alinhados com o contrato', () => {
    expect(Object.values(UserStatus).sort()).toEqual(['ACTIVE', 'DISABLED', 'INVITED']);
    expect(Object.values(AccountStatus).sort()).toEqual(['ACTIVE', 'SUSPENDED']);
    expect(Object.values(ExecutorType).sort()).toEqual(['INTERNAL', 'THIRD_PARTY']);
  });
});
