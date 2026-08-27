import { Module } from '@nestjs/common';

import { AuditModule } from '../audit/audit.module';
import { AuthModule } from '../auth/auth.module';
import { AuthorizationModule } from '../authorization/authorization.module';
import { MemberPolicyService } from './member-policy.service';
import { ProfileService } from './profile.service';
import {
  CompanyMembersController,
  MembershipsController,
  UsersController,
} from './team.controller';
import { TeamService } from './team.service';
import { UserLifecycleService } from './user-lifecycle.service';

/**
 * Gestão de equipe — o ciclo de vida da pessoa depois que ela entra.
 *
 * Importa `AuthModule` por causa do `TokenService`: desligar alguém precisa
 * derrubar as sessões dele no mesmo ato, senão o refresh token que ele já tem
 * continua valendo por trinta dias.
 */
@Module({
  imports: [AuthModule, AuthorizationModule, AuditModule],
  controllers: [UsersController, CompanyMembersController, MembershipsController],
  providers: [MemberPolicyService, TeamService, UserLifecycleService, ProfileService],
  exports: [MemberPolicyService, TeamService, UserLifecycleService, ProfileService],
})
export class TeamModule {}
