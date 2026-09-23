import type { Prisma } from '@prisma/client';
import { deriveCompanyStatus, type CompanyStatus, type CompanySummary } from '@normatiza/shared';

/**
 * O que o banco precisa trazer para o status de uma empresa ser derivado.
 *
 * Um lugar só, porque três telas perguntam a mesma coisa — a sessão (sidebar e
 * guarda de rota), a Equipe e a lista de empresas — e uma quarta resposta
 * divergente seria a empresa "ativa" na sidebar e "aguardando Gestor" na lista.
 */
export const COM_GESTORES = {
  memberships: {
    where: { isActive: true, roles: { has: 'MANAGER' } },
    select: {
      user: {
        select: {
          id: true,
          name: true,
          email: true,
          phone: true,
          jobTitle: true,
          status: true,
          invitation: { select: { status: true, expiresAt: true } },
        },
      },
    },
  },
} satisfies Prisma.CompanyInclude;

export type EmpresaComGestores = Prisma.CompanyGetPayload<{ include: typeof COM_GESTORES }>;

export function statusDaEmpresa(
  company: Pick<EmpresaComGestores, 'deactivatedAt' | 'memberships'>,
  agora: Date = new Date(),
): CompanyStatus {
  return deriveCompanyStatus(
    {
      deactivatedAt: company.deactivatedAt,
      managers: company.memberships.map((v) => ({
        userStatus: v.user.status,
        invitation: v.user.invitation,
      })),
    },
    agora,
  );
}

/** Os Gestores que contam — desligado não é Gestor de ninguém. */
export function gestoresDaEmpresa(company: Pick<EmpresaComGestores, 'memberships'>) {
  return company.memberships
    .map((v) => v.user)
    .filter((u) => u.status !== 'DISABLED')
    .sort((a, b) => a.name.localeCompare(b.name));
}

export function resumoDaEmpresa(
  company: Pick<EmpresaComGestores, 'id' | 'tradeName' | 'corporateName' | 'deactivatedAt' | 'memberships'>,
): CompanySummary {
  return {
    id: company.id,
    tradeName: company.tradeName,
    corporateName: company.corporateName,
    status: statusDaEmpresa(company),
  };
}
