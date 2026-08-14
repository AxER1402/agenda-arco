/**
 * Jest + React Testing Library para el frontend (requisito 22).
 * El archivo es .cjs porque package.json declara "type": "module".
 */
module.exports = {
  testEnvironment: 'jsdom',
  roots: ['<rootDir>/src'],
  testMatch: ['**/tests/**/*.test.{js,jsx}'],
  setupFilesAfterEnv: ['<rootDir>/src/tests/setup.js'],
  moduleNameMapper: {
    // Mismo alias que vite.config.js y jsconfig.json.
    '^@/(.*)$': '<rootDir>/src/$1',
    // Las hojas de estilo no aportan nada a las pruebas de comportamiento.
    '\\.(css|scss|sass|less)$': 'identity-obj-proxy',
    '\\.(png|jpe?g|gif|svg|webp|woff2?)$': '<rootDir>/src/tests/fileMock.js',
  },
  clearMocks: true,
  collectCoverageFrom: [
    'src/**/*.{js,jsx}',
    '!src/main.jsx',
    '!src/tests/**',
    '!src/components/ui/**',
  ],
  coverageDirectory: 'coverage',
};
