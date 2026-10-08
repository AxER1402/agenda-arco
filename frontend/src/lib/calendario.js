/**
 * Qué días no se puede dar cita, según la configuración del laboratorio.
 *
 * Es la misma regla que aplica el backend (días de la semana de atención y
 * feriados); aquí solo sirve para apagar esos días en el calendario antes de
 * que alguien los elija. El backend sigue siendo quien decide.
 */

/** En plural, para «no se atiende los …». Índice ISO-8601: 1 es lunes y 7, domingo. */
const NOMBRES_DIA = ['', 'lunes', 'martes', 'miércoles', 'jueves', 'viernes', 'sábados', 'domingos'];

function diaDeLaSemana(iso) {
  const dia = new Date(`${iso}T00:00:00Z`).getUTCDay();
  return dia === 0 ? 7 : dia;
}

/**
 * El feriado que cae en esa fecha, o `null`. Los anuales coinciden por día y
 * mes, sea cual sea el año.
 *
 * @param {string} iso
 * @param {Array<{fecha: string, descripcion: string, anual: boolean}>} feriados
 */
export function feriadoEn(iso, feriados = []) {
  return (
    feriados.find((feriado) =>
      feriado.anual ? feriado.fecha.slice(5) === iso.slice(5) : feriado.fecha === iso,
    ) ?? null
  );
}

/**
 * Por qué no se atiende ese día, o `null` si se atiende.
 * Sin configuración todavía cargada no se apaga nada.
 *
 * @param {string} iso
 * @param {{dias_laborables?: number[], dias_feriados?: object[]}|null} configuracion
 * @returns {string|null}
 */
export function motivoDiaCerrado(iso, configuracion) {
  if (!configuracion) return null;

  const feriado = feriadoEn(iso, configuracion.dias_feriados ?? []);
  if (feriado) return feriado.descripcion ? `Feriado: ${feriado.descripcion}` : 'Feriado';

  const laborables = configuracion.dias_laborables;
  if (Array.isArray(laborables) && !laborables.includes(diaDeLaSemana(iso))) {
    return `No se atiende los ${NOMBRES_DIA[diaDeLaSemana(iso)]}`;
  }

  return null;
}
