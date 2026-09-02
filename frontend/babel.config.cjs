/**
 * Babel solo se usa para las pruebas: Vite compila con esbuild en dev y build.
 * Jest necesita transformar JSX y módulos ESM a algo que Node entienda.
 */

/**
 * El bloque va bajo `env.test`, que Babel elige por `BABEL_ENV` y, si no está,
 * por `NODE_ENV`. Dentro del contenedor `NODE_ENV` vale «development», así que
 * `npm test` fija `BABEL_ENV=test` a mano (package.json): sin eso el plugin no
 * se aplica y las pruebas revientan al leer `import.meta`.
 *
 * `import.meta.env` es sintaxis de módulo ESM que Vite resuelve al compilar;
 * Jest transpila a CommonJS y no sabe interpretarla. Este plugin la sustituye
 * por `process.env` durante las pruebas, de modo que el código de la aplicación
 * no necesita ramas especiales para el entorno de test.
 */
function reemplazarImportMeta() {
  return {
    visitor: {
      MetaProperty(path) {
        path.replaceWithSourceString('({ env: process.env })');
      },
    },
  };
}

module.exports = {
  presets: [
    ['@babel/preset-env', { targets: { node: 'current' } }],
    ['@babel/preset-react', { runtime: 'automatic' }],
  ],
  env: {
    test: {
      plugins: [reemplazarImportMeta],
    },
  },
};
