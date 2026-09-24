import type {
  CompanyActions,
  CompanyDetail,
  CompanyListItem,
  CompanyProfile,
} from '@normatiza/shared';

import { BRF, SEARA } from '../../auth/testing/sessao';

/** As empresas do elenco como a carteira as devolve. */

export const TUDO: CompanyActions = { edit: true, deactivate: true, reactivate: false, inviteManager: true };
export const NADA: CompanyActions = { edit: false, deactivate: false, reactivate: false, inviteManager: false };

export function linhaDeEmpresa(over: Partial<CompanyListItem> = {}): CompanyListItem {
  return {
    id: BRF.id,
    tradeName: 'BRF',
    corporateName: 'BRF S.A.',
    document: '22222222000191',
    city: 'Concórdia',
    state: 'SC',
    status: 'ACTIVE',
    managers: [{ id: 'u-marcos', name: 'Marcos', pending: false }],
    equipmentsCount: 0,
    openPointsCount: 0,
    actions: TUDO,
    ...over,
  };
}

export const CARTEIRA: CompanyListItem[] = [
  linhaDeEmpresa(),
  linhaDeEmpresa({
    id: SEARA.id,
    tradeName: 'Seara',
    corporateName: 'Seara Alimentos Ltda.',
    document: '33333333000191',
    city: 'Seara',
    state: 'SC',
    status: 'IMPLANTATION',
    managers: [],
  }),
];

export function perfilDaBrf(over: Partial<CompanyProfile> = {}): CompanyProfile {
  return {
    view: 'CLIENT',
    id: BRF.id,
    tradeName: 'BRF',
    corporateName: 'BRF S.A.',
    document: '22222222000191',
    stateRegistration: '254.123.456',
    contact: { name: 'Marcos', role: 'Coordenador de SST', email: 'marcos@email.com', phone: '4934411000' },
    address: {
      zipCode: '89700000',
      street: 'Rua Senador Atílio Fontana',
      number: '86',
      district: 'Centro',
      city: 'Concórdia',
      state: 'SC',
    },
    status: 'ACTIVE',
    accountName: 'Normatiza',
    technicalResponsibles: [{ name: 'Carla', registryType: 'CREA', registryNumber: 'CREA-SP 111111' }],
    ...over,
  };
}

export function detalheDaBrf(over: Partial<CompanyDetail> = {}): CompanyDetail {
  return {
    ...perfilDaBrf(),
    view: 'CONSULTANCY',
    group: { id: 'g-brf', name: 'Grupo BRF' },
    externalCode: 'CLI-0001',
    notes: 'Visitas técnicas só às terças.',
    managers: [
      {
        id: 'u-marcos',
        name: 'Marcos',
        pending: false,
        email: 'marcos@email.com',
        phone: '4934411000',
        jobTitle: 'Coordenador de SST',
      },
    ],
    actions: TUDO,
    ...over,
  };
}
