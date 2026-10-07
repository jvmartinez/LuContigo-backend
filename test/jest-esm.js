/**
 * NestJS 12 se publica solo como ESM y Jest carga módulos como CommonJS. Este transformador
 * convierte a CommonJS los paquetes `@nestjs/*` (el resto de node_modules no se transforma).
 */
const { createHash } = require('node:crypto');
const ts = require('typescript');

const URL_MODULO = "require('node:url').pathToFileURL(__filename).href";

function aCommonJs(codigo, archivo) {
  const adaptado = codigo
    // En CommonJS `require` ya existe y no se puede redeclarar.
    .replace(/^const require = createRequire\(import\.meta\.url\);$/m, '')
    .replace(/import\.meta\.url/g, URL_MODULO);
  return ts.transpileModule(adaptado, {
    fileName: archivo,
    compilerOptions: {
      module: ts.ModuleKind.CommonJS,
      target: ts.ScriptTarget.ES2022,
      esModuleInterop: true,
      allowJs: true,
      inlineSourceMap: true,
    },
  }).outputText;
}

module.exports = {
  process: (codigo, archivo) => ({ code: aCommonJs(codigo, archivo) }),
  getCacheKey: (codigo, archivo) =>
    createHash('sha256').update('esm-cjs-v1').update(archivo).update(codigo).digest('hex'),
  /** Configuración compartida por los jest config de unitarias e integración. */
  transformacionEsm: {
    transform: {
      '^.+\\.ts$': 'ts-jest',
      '^.+\\.js$': '<rootDir>/../test/jest-esm.js',
    },
    transformIgnorePatterns: ['/node_modules/(?!@nestjs/)'],
  },
};
