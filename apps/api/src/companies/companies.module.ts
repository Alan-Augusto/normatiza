import { Module } from '@nestjs/common';

import { AuditModule } from '../audit/audit.module';
import { AuthModule } from '../auth/auth.module';
import { AuthorizationModule } from '../authorization/authorization.module';
import { CompaniesController, CompanyGroupsController } from './companies.controller';
import { CompaniesService } from './companies.service';
import { CompanyWriteGuard } from './company-write-guard.service';

/** Cadastro de empresas — docs/planos/cadastro-de-empresas.md. */
@Module({
  imports: [AuthModule, AuthorizationModule, AuditModule],
  controllers: [CompaniesController, CompanyGroupsController],
  providers: [CompaniesService, CompanyWriteGuard],
  exports: [CompaniesService, CompanyWriteGuard],
})
export class CompaniesModule {}
