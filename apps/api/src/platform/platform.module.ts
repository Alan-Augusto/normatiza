import { Module } from '@nestjs/common';

import { PlatformAdminController } from './platform-admin.controller';
import { PlatformAdminModule } from './platform-admin.module';
import { AuthModule } from '../auth/auth.module';

/** As rotas do Contexto 0. Autenticação vem do `AuthModule`; a decisão de quem é admin, do núcleo. */
@Module({
  imports: [AuthModule, PlatformAdminModule],
  controllers: [PlatformAdminController],
})
export class PlatformModule {}
