/**
 * Disponibilidad de la agenda: límite diario, días laborables y sugerencia de
 * fechas válidas (requisitos 13, 14 y 7).
 *
 * Se mantiene separado de cita.service para que la lógica de "¿cabe una cita
 * este día?" pueda probarse y reutilizarse sin crear ninguna cita.
 */
const citaModel = require('../models/cita.model');
const configuracionService = require('./configuracion.service');
const fechas = require('../utils/fechas');

const { CLAVES } = configuracionService;

/** Parámetros de agenda vigentes. Se leen una vez por operación. */
async function obtenerParametros() {
  const configuracion = await configuracionService.obtenerTodas();

  return {
    limiteDiario: configuracion[CLAVES.LIMITE_DIARIO],
    diasLaborables: configuracion[CLAVES.DIAS_LABORABLES],
    horaApertura: configuracion[CLAVES.HORA_APERTURA],
    horaCierre: configuracion[CLAVES.HORA_CIERRE],
    intervaloMinutos: configuracion[CLAVES.INTERVALO_MINUTOS],
  };
}

function esDiaLaborable(fechaISO, diasLaborables) {
  return diasLaborables.includes(fechas.diaDeLaSemana(fechaISO));
}

/**
 * Estado de un día concreto.
 * @param {string} fechaISO
 * @param {number} [excluirCita] Cita que se está reprogramando: su lugar actual
 *   no debe contar como ocupado si se queda en el mismo día.
 */
async function evaluarDia(fechaISO, { parametros = null } = {}) {
  const config = parametros ?? (await obtenerParametros());
  const ocupacion = await citaModel.contarOcupacion(fechaISO);

  const laborable = esDiaLaborable(fechaISO, config.diasLaborables);
  const disponibles = Math.max(config.limiteDiario - ocupacion, 0);

  return {
    fecha: fechaISO,
    laborable,
    limite: config.limiteDiario,
    ocupacion,
    disponibles,
    hayEspacio: laborable && disponibles > 0,
  };
}

/**
 * Busca días con espacio dentro de una ventana.
 *
 * Se usa en tres situaciones:
 *   - la fecha elegida supera la vigencia de la orden → se buscan fechas
 *     ANTES del vencimiento;
 *   - el día elegido está lleno → se buscan otros días con cupo;
 *   - al recibir una orden nueva → se propone dónde cabe la cita.
 *
 * @param {'PRONTO'|'CERCA_DEL_VENCIMIENTO'} [preferencia] Con `PRONTO` recorre
 *   la ventana desde el principio (la fecha más próxima primero); con
 *   `CERCA_DEL_VENCIMIENTO` la recorre desde el final, para aprovechar la
 *   vigencia completa de la orden.
 * @returns {Promise<Array<{fecha: string, disponibles: number}>>}
 */
async function sugerirFechas({
  desde,
  hasta,
  cantidad = 3,
  excluirFechas = [],
  preferencia = 'PRONTO',
} = {}) {
  const parametros = await obtenerParametros();

  const inicio = fechas.comparar(desde, fechas.hoy()) < 0 ? fechas.hoy() : fechas.aISO(desde);
  const fin = fechas.aISO(hasta);

  // Si la ventana ya pasó por completo no hay nada que sugerir.
  if (!inicio || !fin || fechas.comparar(inicio, fin) > 0) return [];

  const ocupaciones = await citaModel.contarOcupacionPorRango({ desde: inicio, hasta: fin });
  const excluidas = new Set(excluirFechas);

  const haciaAtras = preferencia === 'CERCA_DEL_VENCIMIENTO';
  const primera = haciaAtras ? fin : inicio;
  const siguiente = (fecha) => fechas.sumarDias(fecha, haciaAtras ? -1 : 1);
  const dentroDeLaVentana = (fecha) =>
    haciaAtras ? fechas.comparar(fecha, inicio) >= 0 : fechas.comparar(fecha, fin) <= 0;

  const sugerencias = [];

  for (let fecha = primera; dentroDeLaVentana(fecha); fecha = siguiente(fecha)) {
    if (sugerencias.length >= cantidad) break;
    if (excluidas.has(fecha)) continue;
    if (!esDiaLaborable(fecha, parametros.diasLaborables)) continue;

    const disponibles = parametros.limiteDiario - (ocupaciones.get(fecha) ?? 0);
    if (disponibles > 0) sugerencias.push({ fecha, disponibles });
  }

  return sugerencias;
}

/**
 * Sugerencias para una orden concreta.
 *
 * Nunca propone una fecha posterior al vencimiento, porque sería una fecha que
 * el sistema volvería a rechazar. Se ofrecen las más cercanas al vencimiento
 * primero: es lo que pidió el laboratorio, para agotar la vigencia de la orden
 * antes que los días próximos.
 */
async function sugerirFechasParaOrden(orden, { cantidad = 3, excluirFechas = [] } = {}) {
  return sugerirFechas({
    desde: fechas.hoy(),
    hasta: orden.fecha_vencimiento,
    cantidad,
    excluirFechas,
    preferencia: 'CERCA_DEL_VENCIMIENTO',
  });
}

/**
 * Horas libres de un día, según el horario y el intervalo configurados.
 * Sirve para que la interfaz proponga una hora en vez de pedirla a ciegas.
 */
async function horasDisponibles(fechaISO) {
  const parametros = await obtenerParametros();

  if (!esDiaLaborable(fechaISO, parametros.diasLaborables)) return [];

  const citas = await citaModel.listarPorRango({
    desde: fechaISO,
    hasta: fechaISO,
    incluirCanceladas: false,
  });

  const ocupadas = new Set(citas.map((cita) => String(cita.hora).slice(0, 5)));
  const horas = [];

  const aMinutos = (hora) => {
    const [h, m] = hora.split(':').map(Number);
    return h * 60 + m;
  };

  const cierre = aMinutos(parametros.horaCierre);

  for (
    let minutos = aMinutos(parametros.horaApertura);
    minutos < cierre;
    minutos += parametros.intervaloMinutos
  ) {
    const hora = `${String(Math.floor(minutos / 60)).padStart(2, '0')}:${String(minutos % 60).padStart(2, '0')}`;
    horas.push({ hora, ocupada: ocupadas.has(hora) });
  }

  return horas;
}

module.exports = {
  obtenerParametros,
  esDiaLaborable,
  evaluarDia,
  sugerirFechas,
  sugerirFechasParaOrden,
  horasDisponibles,
};
