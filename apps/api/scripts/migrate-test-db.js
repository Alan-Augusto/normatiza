/**
 * Aplica as migrações na branch de teste do Neon.
 *
 * O Prisma só enxerga `DATABASE_URL`; este script troca o valor por
 * `TEST_DATABASE_URL` no processo filho, para que rodar as migrações de teste
 * nunca possa acertar o banco de desenvolvimento por engano.
 */
const { execFileSync } = require('node:child_process');
require('dotenv').config();

const url = process.env.TEST_DATABASE_URL;

if (!url) {
  console.error('TEST_DATABASE_URL não definida no .env — crie a branch de teste no Neon.');
  process.exit(1);
}

if (url === process.env.DATABASE_URL) {
  console.error('TEST_DATABASE_URL é igual à DATABASE_URL. Use uma branch dedicada.');
  process.exit(1);
}

// As migrações não usam `DATABASE_URL`: usam `directUrl` (o schema aponta para
// `DIRECT_URL`, a conexão sem o pgbouncer do Neon). Trocar só a primeira
// deixava a segunda apontando para o banco de desenvolvimento — e as migrações
// "de teste" iam parar lá. A conexão direta da branch de teste é a mesma URL
// sem o sufixo `-pooler` no host, salvo se `TEST_DIRECT_URL` disser outra.
const direct = process.env.TEST_DIRECT_URL ?? url.replace('-pooler.', '.');

if (direct === process.env.DIRECT_URL || direct === process.env.DATABASE_URL) {
  console.error('A conexão direta de teste aponta para o banco de desenvolvimento. Defina TEST_DIRECT_URL.');
  process.exit(1);
}

execFileSync('prisma', ['migrate', 'deploy'], {
  stdio: 'inherit',
  env: { ...process.env, DATABASE_URL: url, DIRECT_URL: direct },
});
