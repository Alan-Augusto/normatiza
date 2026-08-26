/**
 * Testes unitários e de integração — ficam lado a lado com o código
 * (`*.spec.ts`), conforme docs/backend/testes.md.
 */
module.exports = {
  moduleFileExtensions: ['js', 'json', 'ts'],
  rootDir: 'src',
  testRegex: '.*\\.spec\\.ts$',
  transform: {
    '^.+\\.ts$': ['ts-jest', { tsconfig: '<rootDir>/../tsconfig.json' }],
  },
  collectCoverageFrom: ['**/*.(t|j)s'],
  coverageDirectory: '../coverage',
  testEnvironment: 'node',
  // Decorators de class-validator/Nest dependem de Reflect.getMetadata.
  setupFiles: ['reflect-metadata'],
  moduleNameMapper: {
    '^@normatiza/shared$': '<rootDir>/../../../packages/shared/src/index.ts',
    '^@normatiza/shared/(.*)$': '<rootDir>/../../../packages/shared/src/$1',
  },
};
