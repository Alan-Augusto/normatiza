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

execFileSync('prisma', ['migrate', 'deploy'], {
  stdio: 'inherit',
  env: { ...process.env, DATABASE_URL: url },
});
