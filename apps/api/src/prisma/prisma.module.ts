import { Global, Module } from '@nestjs/common';

import { PrismaService } from './prisma.service';

/**
 * Global: todo módulo de negócio depende do acesso ao banco, e repetir o import
 * em cada um deles é ruído sem contrapartida.
 */
@Global()
@Module({
  providers: [PrismaService],
  exports: [PrismaService],
})
export class PrismaModule {}
