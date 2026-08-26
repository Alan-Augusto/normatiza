import { Global, Module } from '@nestjs/common';

import { PermissionService } from './permission.service';

/** Global: autorização é transversal — todo módulo de negócio vai consultá-la. */
@Global()
@Module({
  providers: [PermissionService],
  exports: [PermissionService],
})
export class AuthorizationModule {}
