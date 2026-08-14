/**
 * Reglas del DPI guatemalteco.
 *
 * El documento tiene exactamente 13 dígitos: 1111111111111 es válido y
 * 1111111111 no, porque le faltan tres. El dato es opcional en el paciente,
 * pero si se escribe tiene que estar completo.
 *
 * Igual que con el teléfono, esta es la única definición de la regla en el
 * backend; validadores y servicios la usan desde aquí.
 */
const DPI_GUATEMALA = /^[0-9]{13}$/;

/**
 * Limpia lo que el usuario pudo haber escrito: espacios y guiones.
 * "1111 11111 1111" y "1111111111111" son el mismo documento.
 *
 * @param {unknown} valor
 * @returns {string} solo dígitos.
 */
function normalizarDpi(valor) {
  if (typeof valor !== 'string' && typeof valor !== 'number') return '';
  return String(valor).replace(/\D/g, '');
}

/** @returns {boolean} true si tiene exactamente 13 dígitos. */
function esDpiValido(valor) {
  return DPI_GUATEMALA.test(normalizarDpi(valor));
}

/**
 * Vacío y DPI completo son las dos únicas entradas aceptables: el campo es
 * opcional, pero a medias no sirve.
 */
function esDpiOpcionalValido(valor) {
  if (valor === undefined || valor === null || String(valor).trim() === '') return true;
  return esDpiValido(valor);
}

/** Formato legible: 1111 11111 1111. */
function formatearDpi(valor) {
  const normalizado = normalizarDpi(valor);
  if (!DPI_GUATEMALA.test(normalizado)) return String(valor ?? '');

  return `${normalizado.slice(0, 4)} ${normalizado.slice(4, 9)} ${normalizado.slice(9)}`;
}

module.exports = {
  DPI_GUATEMALA,
  normalizarDpi,
  esDpiValido,
  esDpiOpcionalValido,
  formatearDpi,
};
