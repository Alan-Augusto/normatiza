import { Module } from '@nestjs/common';

import { AuditModule } from '../audit/audit.module';
import { AuthModule } from '../auth/auth.module';
import { AuthorizationModule } from '../authorization/authorization.module';
import { CompaniesModule } from '../companies/companies.module';
import { EquipmentsService } from './equipments.service';
import { EquipmentsController, MachineTypesController, SectorsController } from './inventory.controller';
import { InventoryAccess } from './inventory-access.service';
import { MachineTypesService } from './machine-types.service';
import { SectorsService } from './sectors.service';

/** O inventário da planta — docs/planos/cadastro-de-equipamentos.md. */
@Module({
  imports: [AuthModule, AuthorizationModule, AuditModule, CompaniesModule],
  controllers: [EquipmentsController, SectorsController, MachineTypesController],
  providers: [InventoryAccess, EquipmentsService, SectorsService, MachineTypesService],
})
export class InventoryModule {}
