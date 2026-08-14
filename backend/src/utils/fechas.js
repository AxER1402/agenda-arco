/**
 * Utilidades de fecha del sistema.
 *
 * Decisión importante: las fechas de negocio se manejan como cadenas
 * 'YYYY-MM-DD', no como objetos Date. La vigencia de una orden y la agenda se
 * razonan por día calendario, y un Date arrastra hora y zona horaria que
 * pueden desplazar el día (el clásico "se guardó un día antes").
 *
 * Todos los cálculos internos usan UTC para que el resultado no dependa de la
 * zona horaria del servidor.
 */

const ZONA_HORARIA = process.env.TZ || 'America/Guatemala';

const FORMATO_ISO = /^\d{4}-\d{2}-\d{2}$/;

/** Día de hoy en la zona horaria del laboratorio, como 'YYYY-MM-DD'. */
function hoy() {
  // 'en-CA' produce exactamente el formato YYYY-MM-DD.
  return new Intl.DateTimeFormat('en-CA', {
    timeZone: ZONA_HORARIA,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).format(new Date());
}

/**
 * Convierte a 'YYYY-MM-DD'. Acepta cadenas ISO y objetos Date (los que
 * devuelve el driver de MySQL en algunas configuraciones).
 * @returns {string|null} null si el valor no es una fecha utilizable.
 */
function aISO(valor) {
  if (valor instanceof Date && !Number.isNaN(valor.getTime())) {
    return valor.toISOString().slice(0, 10);
  }

  if (typeof valor === 'string') {
    const recortada = valor.slice(0, 10);
    return FORMATO_ISO.test(recortada) && esFechaReal(recortada) ? recortada : null;
  }

  return null;
}

/** Comprueba que la fecha exista de verdad: rechaza 2026-02-31. */
function esFechaReal(fechaISO) {
  if (!FORMATO_ISO.test(fechaISO)) return false;

  const [anio, mes, dia] = fechaISO.split('-').map(Number);
  if (mes < 1 || mes > 12 || dia < 1) return false;

  return dia <= ultimoDiaDelMes(anio, mes);
}

/** @returns {boolean} true si el valor es una fecha válida en formato ISO. */
function esFechaValida(valor) {
  return aISO(valor) !== null;
}

function ultimoDiaDelMes(anio, mes) {
  return new Date(Date.UTC(anio, mes, 0)).getUTCDate();
}

/**
 * Suma meses respetando el fin de mes.
 * 31/12 + 3 meses = 31/03, pero 30/11 + 3 meses = 28/02 (o 29 en año bisiesto),
 * porque el 30 de febrero no existe.
 */
function sumarMeses(fechaISO, meses) {
  const base = aISO(fechaISO);
  if (!base) return null;

  const [anio, mes, dia] = base.split('-').map(Number);

  const totalMeses = (anio * 12 + (mes - 1)) + meses;
  const anioResultante = Math.floor(totalMeses / 12);
  const mesResultante = (totalMeses % 12) + 1;
  const diaResultante = Math.min(dia, ultimoDiaDelMes(anioResultante, mesResultante));

  return formatear(anioResultante, mesResultante, diaResultante);
}

function sumarDias(fechaISO, dias) {
  const base = aISO(fechaISO);
  if (!base) return null;

  const [anio, mes, dia] = base.split('-').map(Number);
  const resultado = new Date(Date.UTC(anio, mes - 1, dia + dias));

  return resultado.toISOString().slice(0, 10);
}

function formatear(anio, mes, dia) {
  return `${String(anio).padStart(4, '0')}-${String(mes).padStart(2, '0')}-${String(dia).padStart(2, '0')}`;
}

/**
 * Compara dos fechas por día calendario.
 * @returns {number} negativo si a < b, 0 si son el mismo día, positivo si a > b.
 */
function comparar(a, b) {
  const primera = aISO(a);
  const segunda = aISO(b);

  if (primera === null || segunda === null) {
    throw new TypeError('Se intentó comparar una fecha inválida.');
  }

  return primera < segunda ? -1 : primera > segunda ? 1 : 0;
}

/** Días completos entre dos fechas (b - a). */
function diferenciaEnDias(a, b) {
  const primera = aISO(a);
  const segunda = aISO(b);
  if (primera === null || segunda === null) return null;

  const msPorDia = 24 * 60 * 60 * 1000;
  return Math.round((Date.parse(`${segunda}T00:00:00Z`) - Date.parse(`${primera}T00:00:00Z`)) / msPorDia);
}

/** Día de la semana según ISO-8601: 1 = lunes ... 7 = domingo. */
function diaDeLaSemana(fechaISO) {
  const base = aISO(fechaISO);
  if (!base) return null;

  const dia = new Date(`${base}T00:00:00Z`).getUTCDay();
  return dia === 0 ? 7 : dia;
}

/** Lunes de la semana a la que pertenece la fecha. */
function inicioDeSemana(fechaISO) {
  return sumarDias(fechaISO, -(diaDeLaSemana(fechaISO) - 1));
}

/** Primer y último día del mes de la fecha dada. */
function rangoDelMes(fechaISO) {
  const base = aISO(fechaISO);
  if (!base) return null;

  const [anio, mes] = base.split('-').map(Number);
  return {
    desde: formatear(anio, mes, 1),
    hasta: formatear(anio, mes, ultimoDiaDelMes(anio, mes)),
  };
}

/** Formato para mostrar al usuario y en los mensajes: 10/08/2026. */
function aFormatoLocal(fechaISO) {
  const base = aISO(fechaISO);
  if (!base) return '';

  const [anio, mes, dia] = base.split('-');
  return `${dia}/${mes}/${anio}`;
}

/** Convierte 'HH:MM:SS' o 'HH:MM' a '09:00 AM'. */
function horaAFormatoLocal(hora) {
  if (typeof hora !== 'string') return '';

  const [horasTexto, minutos = '00'] = hora.split(':');
  const horas = Number(horasTexto);
  if (Number.isNaN(horas)) return '';

  const sufijo = horas >= 12 ? 'PM' : 'AM';
  const horas12 = horas % 12 === 0 ? 12 : horas % 12;

  return `${String(horas12).padStart(2, '0')}:${minutos} ${sufijo}`;
}

module.exports = {
  ZONA_HORARIA,
  hoy,
  aISO,
  esFechaValida,
  esFechaReal,
  ultimoDiaDelMes,
  sumarMeses,
  sumarDias,
  comparar,
  diferenciaEnDias,
  diaDeLaSemana,
  inicioDeSemana,
  rangoDelMes,
  aFormatoLocal,
  horaAFormatoLocal,
};
