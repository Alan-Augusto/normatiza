import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';

import { PrismaClient } from '@prisma/client';
import { config as loadEnv } from 'dotenv';

import {
  ArquivoDeCatalogoInvalido,
  importarCatalogosDoLegado,
  TABELAS_DO_LEGADO,
  validarArquivo,
} from '../../src/catalogs/legacy-catalog-import';

loadEnv();

/**
 * Carrega os catálogos da análise no banco do `DATABASE_URL` (docs/migracao §7).
 *
 * Uso:
 *   pnpm catalogos:importar                      # prisma/catalogos/legado.json
 *   pnpm catalogos:importar --arquivo outro.json
 *
 * Pode rodar quantas vezes quiser: o que já veio é atualizado, nada duplica e
 * nada é apagado.
 */

const i = process.argv.indexOf('--arquivo');
const caminho = resolve(i === -1 ? 'prisma/catalogos/legado.json' : process.argv[i + 1]);

async function main() {
  const prisma = new PrismaClient();
  try {
    const linhas = validarArquivo(JSON.parse(readFileSync(caminho, 'utf-8')));
    const relatorio = await importarCatalogosDoLegado(prisma, linhas);

    console.log(`Catálogos de ${caminho}`);
    if (relatorio.tabelaHrnCriada) console.log('Tabela HRN inicial criada.');
    for (const tabela of TABELAS_DO_LEGADO) {
      const r = relatorio.tabelas[tabela];
      console.log(
        `  ${tabela.padEnd(20)} ${String(r.criados).padStart(4)} criados · ${String(r.atualizados).padStart(4)} atualizados · ${String(r.iguais).padStart(4)} iguais`,
      );
      if (r.ausentes.length > 0) {
        console.log(`  ${''.padEnd(20)} fora do arquivo, mantidos: ${r.ausentes.join(', ')}`);
      }
    }
  } catch (erro) {
    console.error(erro instanceof ArquivoDeCatalogoInvalido ? erro.message : erro);
    process.exitCode = 1;
  } finally {
    await prisma.$disconnect();
  }
}

void main();
