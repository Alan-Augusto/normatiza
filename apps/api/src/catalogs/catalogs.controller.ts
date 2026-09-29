import { Controller, Get, Header, UseGuards } from '@nestjs/common';
import type { AnalysisCatalogsDto } from '@normatiza/shared';

import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { CatalogsService } from './catalogs.service';

/**
 * Os catálogos globais (docs/produto/04 §7). Prefixo próprio, que entra no
 * nginx. Qualquer pessoa logada lê: não há nada de conta nem de empresa aqui.
 */
@Controller('catalogs')
@UseGuards(JwtAuthGuard)
export class CatalogsController {
  constructor(private readonly catalogs: CatalogsService) {}

  /**
   * O Express já responde com `ETag` e devolve 304 a quem manda o mesmo
   * `If-None-Match`; `no-cache` faz o navegador sempre conferir antes de usar
   * o que guardou, e o catálogo novo chega na primeira leitura depois da troca.
   */
  @Get('analysis')
  @Header('Cache-Control', 'private, no-cache')
  analysis(): Promise<AnalysisCatalogsDto> {
    return this.catalogs.analysisCatalogs();
  }
}
