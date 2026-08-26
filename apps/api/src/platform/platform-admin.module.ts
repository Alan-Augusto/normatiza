import { Module } from '@nestjs/common';

import { PlatformAdminGuard } from './platform-admin.guard';
import { PlatformAdminService } from './platform-admin.service';

/**
 * O núcleo: "esta pessoa é admin da plataforma?".
 *
 * Sem controller de propósito. O `AuthModule` depende daqui para marcar a
 * sessão, e a camada HTTP do Contexto 0 ([platform.module.ts](./platform.module.ts))
 * depende do `AuthModule` para autenticar. Juntar as duas coisas num módulo só
 * fecharia o ciclo, e a resposta a "quem é admin" passaria a ter duas
 * implementações — uma para a sessão, outra para as rotas.
 */
@Module({
  providers: [PlatformAdminService, PlatformAdminGuard],
  exports: [PlatformAdminService, PlatformAdminGuard],
})
export class PlatformAdminModule {}
