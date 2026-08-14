/**
 * Configuración de Jest para el backend.
 * El backend usa CommonJS a propósito: evita la configuración experimental de
 * módulos ESM en Jest y mantiene las pruebas simples de ejecutar.
 */
module.exports = {
  testEnvironment: 'node',
  roots: ['<rootDir>/src'],
  testMatch: ['**/tests/**/*.test.js'],
  setupFiles: ['<rootDir>/src/tests/setup.js'],
  clearMocks: true,
  collectCoverageFrom: [
    'src/**/*.js',
    '!src/index.js',
    '!src/tests/**',
  ],
  coverageDirectory: 'coverage',
};
