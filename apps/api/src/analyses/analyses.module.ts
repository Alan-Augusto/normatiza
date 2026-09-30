import { Module } from '@nestjs/common';

import { AuditModule } from '../audit/audit.module';
import { AuthModule } from '../auth/auth.module';
import { AuthorizationModule } from '../authorization/authorization.module';
import { CompaniesModule } from '../companies/companies.module';
import { InventoryModule } from '../inventory/inventory.module';
import { AnalysesController } from './analyses.controller';
import { AnalysesService } from './analyses.service';
import { RiskPointsService } from './risk-points.service';

/** A análise de risco — docs/planos/analise-de-risco.md. */
@Module({
  imports: [AuthModule, AuthorizationModule, AuditModule, CompaniesModule, InventoryModule],
  controllers: [AnalysesController],
  providers: [AnalysesService, RiskPointsService],
})
export class AnalysesModule {}
