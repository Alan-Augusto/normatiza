/**
 * Testes e2e (Supertest) — batem no banco real da branch de teste do Neon.
 * `setup-e2e.ts` carrega o `.env`, força NODE_ENV=test e trunca as tabelas
 * entre os testes.
 */
module.exports = {
  moduleFileExtensions: ['js', 'json', 'ts'],
  rootDir: '.',
  testRegex: '.*\\.e2e-spec\\.ts$',
  transform: {
    '^.+\\.ts$': ['ts-jest', { tsconfig: '<rootDir>/../tsconfig.json' }],
  },
  testEnvironment: 'node',
  setupFiles: ['reflect-metadata'],
  setupFilesAfterEnv: ['<rootDir>/setup-e2e.ts'],
  // O Neon é remoto: uma suíte e2e é mais lenta que a de unidade.
  testTimeout: 30_000,
  moduleNameMapper: {
    '^@normatiza/shared$': '<rootDir>/../../../packages/shared/src/index.ts',
    '^@normatiza/shared/(.*)$': '<rootDir>/../../../packages/shared/src/$1',
  },
};
