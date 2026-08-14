import { TextDecoder, TextEncoder } from 'node:util';

import '@testing-library/jest-dom';

// jsdom no incluye TextEncoder/TextDecoder y React Router los necesita.
// Se toman de Node, que sí los trae.
if (typeof globalThis.TextEncoder === 'undefined') {
  globalThis.TextEncoder = TextEncoder;
  globalThis.TextDecoder = TextDecoder;
}

// Las pruebas nunca deben salir a la red ni usar datos reales de pacientes.
// Cada suite declara explícitamente qué respuestas simula.
beforeEach(() => {
  localStorage.clear();
});
