import { createHash } from 'node:crypto';

import { Injectable, NotFoundException } from '@nestjs/common';
import type { AnalysisCatalogsDto } from '@normatiza/shared';

import { PrismaService } from '../prisma/prisma.service';
import { tabelaHrnDe } from './hrn-table';

/** "12.2" antes de "12.10": os códigos comparados número a número. */
const porCódigo = (a: { itemCode: string }, b: { itemCode: string }) =>
  a.itemCode.localeCompare(b.itemCode, 'pt-BR', { numeric: true });

const porNome = (a: { name: string }, b: { name: string }) => a.name.localeCompare(b.name, 'pt-BR');

/** Só o que a tela usa: nada de datas nem de ids de pai, que já estão no agrupamento. */
const item = ({ id, name }: { id: string; name: string }) => ({ id, name });

@Injectable()
export class CatalogsService {
  constructor(private readonly prisma: PrismaService) {}

  /**
   * Tudo que o formulário da análise escolhe, numa resposta só
   * (docs/planos/catalogos-da-analise.md D8). São cerca de mil itens, lidos
   * uma vez: buscar por partes custaria mais idas e voltas do que bytes.
   */
  async analysisCatalogs(): Promise<AnalysisCatalogsDto> {
    const [sections, hazardTypes, protectionTypes, hrn] = await Promise.all([
      this.prisma.standardSection.findMany({
        orderBy: { order: 'asc' },
        include: { standards: { where: { isActive: true } } },
      }),
      this.prisma.hazardType.findMany({ orderBy: { order: 'asc' }, include: { origins: true, consequences: true } }),
      this.prisma.protectionType.findMany({ orderBy: { order: 'asc' }, include: { protections: true } }),
      this.prisma.hrnTableVersion.findFirst({ where: { effectiveTo: null }, orderBy: { effectiveFrom: 'desc' } }),
    ]);
    // A migração semeia a tabela; faltar é banco quebrado, não catálogo vazio.
    if (!hrn) throw new NotFoundException('Nenhuma tabela HRN vigente');

    const hrnTable = tabelaHrnDe(hrn);

    const conteúdo: Omit<AnalysisCatalogsDto, 'version'> = {
      standardSections: sections.map((s) => ({
        id: s.id,
        norm: s.norm,
        name: s.name,
        standards: [...s.standards].sort(porCódigo).map(({ id, itemCode, text }) => ({ id, itemCode, text })),
      })),
      hazardTypes: hazardTypes.map((t) => ({
        id: t.id,
        name: t.name,
        origins: [...t.origins].sort(porNome).map(item),
        consequences: [...t.consequences].sort(porNome).map(item),
      })),
      protectionTypes: protectionTypes.map((t) => ({
        id: t.id,
        name: t.name,
        protections: [...t.protections].sort(porNome).map(item),
      })),
      hrnTable,
    };

    // A versão é o próprio conteúdo: muda quando qualquer item muda, e só então.
    const version = createHash('sha1').update(JSON.stringify(conteúdo)).digest('hex').slice(0, 16);
    return { version, ...conteúdo };
  }
}
