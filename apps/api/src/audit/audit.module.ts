import { Global, Module } from '@nestjs/common';

import { AuditService } from './audit.service';

/** Global: toda ação relevante do sistema precisa deixar rastro. */
@Global()
@Module({
  providers: [AuditService],
  exports: [AuditService],
})
export class AuditModule {}
