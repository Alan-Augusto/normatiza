import { SetMetadata } from '@nestjs/common';
import type { Role } from '@normatiza/shared';

export const PAPÉIS_EXIGIDOS = 'papeis_exigidos';

/**
 * Exige que quem chama tenha **ao menos um** destes papéis.
 *
 * É só a primeira dimensão da autorização. A segunda — a etapa do item sobre o
 * qual se quer agir — pertence à máquina de estados do plano de ação, e nenhuma
 * guarda resolve sozinha: `@Roles('CLIENT_ENGINEER')` diz que o Engenheiro do
 * Cliente pode editar orçamento *em princípio*, não que pode editar **este**.
 */
export const Roles = (...roles: Role[]) => SetMetadata(PAPÉIS_EXIGIDOS, roles);
