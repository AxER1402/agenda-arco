/**
 * Cómo se guarda el nombre de un paciente: en mayúsculas y sin tildes, como
 * los escribe el IGSS en sus órdenes ("MARÍA JOSÉ" → "MARIA JOSE").
 *
 * La Ñ se conserva: no es una tilde sobre la N sino otra letra, y quitarla
 * cambia el apellido ("PEÑA" no es "PENA"). La diéresis sí se quita
 * ("GÜEMES" → "GUEMES").
 *
 * También se recortan los extremos y los espacios repetidos, para que el mismo
 * nombre escrito con prisa no quede guardado de dos maneras.
 *
 * Es la única definición de la regla en el backend; el frontend aplica la
 * misma mientras se escribe para que se vea lo que se va a guardar.
 */

/** Marca temporal para la Ñ mientras se quitan los demás acentos. */
const MARCA_ENE = '\u0000';

/**
 * @param {unknown} valor
 * @returns {string}
 */
function normalizarNombre(valor) {
  if (typeof valor !== 'string') return '';

  return valor
    .toUpperCase()
    .replace(/Ñ/g, MARCA_ENE)
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .replace(new RegExp(MARCA_ENE, 'g'), 'Ñ')
    .replace(/\s+/g, ' ')
    .trim();
}

/** Partículas que van en minúscula dentro de un nombre: «María de los Ángeles». */
const PARTICULAS = new Set(['de', 'del', 'la', 'las', 'los', 'y', 'e', 'da', 'do', 'van', 'von']);

/**
 * El nombre con mayúscula inicial, para el trato al paciente en el
 * recordatorio: «MARIA DE LOS ANGELES PEÑA» → «Maria de los Angeles Peña».
 *
 * En el sistema el nombre se guarda en mayúsculas; un WhatsApp entero en
 * mayúsculas se lee como si se gritara. Las tildes no se recuperan porque ya
 * no están guardadas.
 *
 * @param {unknown} valor
 * @returns {string}
 */
function nombrePropio(valor) {
  if (typeof valor !== 'string') return '';

  return valor
    .trim()
    .toLowerCase()
    .split(/\s+/)
    .filter(Boolean)
    .map((palabra, indice) =>
      indice > 0 && PARTICULAS.has(palabra)
        ? palabra
        : // También tras guion o apóstrofo: «Pérez-Molina», «O'Brien».
          palabra.replace(/(^|[-'’])(\p{L})/gu, (_, separador, letra) => separador + letra.toUpperCase()),
    )
    .join(' ');
}

module.exports = { normalizarNombre, nombrePropio };
