/**
 * Jest para el whatsapp-service.
 *
 * Requisito 23: las pruebas jamás deben abrir WhatsApp Web ni enviar mensajes
 * reales. `whatsapp-web.js` se sustituye por el mock manual de
 * `__mocks__/whatsapp-web.js`, que Jest aplica cuando la prueba llama a
 * jest.mock('whatsapp-web.js').
 */
module.exports = {
  testEnvironment: 'node',
  // rootDir completo (no solo src/) para que Jest descubra el mock manual de
  // node_modules ubicado en <rootDir>/__mocks__/whatsapp-web.js.
  roots: ['<rootDir>'],
  testMatch: ['**/tests/**/*.test.js'],
  setupFiles: ['<rootDir>/src/tests/setup.js'],
  clearMocks: true,
  collectCoverageFrom: ['src/**/*.js', '!src/index.js', '!src/tests/**'],
  coverageDirectory: 'coverage',
};
