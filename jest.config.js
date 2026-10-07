/** Pruebas unitarias (src/**\/*.spec.ts). Las de integración viven en test/. */
const { transformacionEsm } = require('./test/jest-esm');

module.exports = {
  moduleFileExtensions: ['js', 'json', 'ts'],
  rootDir: 'src',
  testRegex: '.*\\.spec\\.ts$',
  ...transformacionEsm,
  testEnvironment: 'node',
  collectCoverageFrom: ['**/*.ts', '!**/*.module.ts', '!main.ts'],
  coverageDirectory: '../coverage',
};
