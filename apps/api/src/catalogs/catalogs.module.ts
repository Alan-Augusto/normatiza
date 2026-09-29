import { Module } from '@nestjs/common';

import { AuthModule } from '../auth/auth.module';
import { CatalogsController } from './catalogs.controller';
import { CatalogsService } from './catalogs.service';

/** Os catálogos da análise — docs/planos/catalogos-da-analise.md. */
@Module({
  imports: [AuthModule],
  controllers: [CatalogsController],
  providers: [CatalogsService],
})
export class CatalogsModule {}
