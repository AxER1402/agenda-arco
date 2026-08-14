/**
 * Reglas del número telefónico de Guatemala (requisito 10).
 *
 * Un número válido tiene exactamente 8 dígitos. Esta es la única definición de
 * la regla en el backend: validadores, servicios y recordatorios la usan desde
 * aquí para que no existan dos versiones que puedan divergir.
 */
const TELEFONO_GUATEMALA = /^[0-9]{8}$/;

const CODIGO_PAIS = '502';

/**
 * Limpia lo que el usuario pudo haber escrito: espacios, guiones, paréntesis y
 * el código de país. "+502 5555-5555" y "55555555" son el mismo número.
 *
 * @param {unknown} valor
 * @returns {string} solo dígitos, sin código de país.
 */
function normalizarTelefono(valor) {
  if (typeof valor !== 'string' && typeof valor !== 'number') return '';

  let digitos = String(valor).replace(/\D/g, '');

  // Quita el código de país solo si lo que queda sigue siendo un número local
  // completo; así "50255555555" se convierte pero "50255555" no se mutila.
  if (digitos.length === 11 && digitos.startsWith(CODIGO_PAIS)) {
    digitos = digitos.slice(CODIGO_PAIS.length);
  }

  return digitos;
}

/**
 * @param {unknown} valor Teléfono ya normalizado o tal como lo escribió el usuario.
 * @returns {boolean}
 */
function esTelefonoValido(valor) {
  return TELEFONO_GUATEMALA.test(normalizarTelefono(valor));
}

/** Formato legible para la interfaz y los mensajes: 5555-5555. */
function formatearTelefono(valor) {
  const normalizado = normalizarTelefono(valor);
  if (!TELEFONO_GUATEMALA.test(normalizado)) return String(valor ?? '');
  return `${normalizado.slice(0, 4)}-${normalizado.slice(4)}`;
}

module.exports = {
  TELEFONO_GUATEMALA,
  CODIGO_PAIS,
  normalizarTelefono,
  esTelefonoValido,
  formatearTelefono,
};
