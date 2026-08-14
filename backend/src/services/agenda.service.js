/**
 * Construcción de la agenda en sus tres vistas: día, semana y mes.
 *
 * La estructura se genera automáticamente a partir de las fechas (requisito 17):
 * no existe ninguna "hoja" que haya que crear a mano cada mes.
 */
const citaModel = require('../models/cita.model');
const ordenService = require('./orden.service');
const disponibilidadService = require('./disponibilidad.service');
const AppError = require('../utils/AppError');
const fechas = require('../utils/fechas');

const VISTAS = ['dia', 'semana', 'mes'];

/** Calcula el rango de fechas que cubre cada vista. */
function calcularRango(vista, fechaReferencia) {
  const base = fechas.aISO(fechaReferencia) ?? fechas.hoy();

  if (vista === 'dia') return { desde: base, hasta: base };

  if (vista === 'semana') {
    const desde = fechas.inicioDeSemana(base);
    return { desde, hasta: fechas.sumarDias(desde, 6) };
  }

  return fechas.rangoDelMes(base);
}

/**
 * Agenda de un rango, día por día, con su ocupación.
 * @param {'dia'|'semana'|'mes'} vista
 * @param {string} fechaReferencia
 */
async function obtenerVista(vista, fechaReferencia, { incluirCanceladas = false } = {}) {
  if (!VISTAS.includes(vista)) {
    throw AppError.badRequest(`La vista debe ser una de: ${VISTAS.join(', ')}.`);
  }

  const { desde, hasta } = calcularRango(vista, fechaReferencia);
  const parametros = await disponibilidadService.obtenerParametros();

  const [citas, ocupaciones] = await Promise.all([
    citaModel.listarPorRango({ desde, hasta, incluirCanceladas }),
    citaModel.contarOcupacionPorRango({ desde, hasta }),
  ]);

  const citasPorFecha = new Map();
  citas.forEach((cita) => {
    if (!citasPorFecha.has(cita.fecha)) citasPorFecha.set(cita.fecha, []);
    citasPorFecha.get(cita.fecha).push(decorarCita(cita));
  });

  const dias = [];
  for (let fecha = desde; fechas.comparar(fecha, hasta) <= 0; fecha = fechas.sumarDias(fecha, 1)) {
    const ocupacion = ocupaciones.get(fecha) ?? 0;
    const laborable = disponibilidadService.esDiaLaborable(fecha, parametros.diasLaborables);

    dias.push({
      fecha,
      dia_semana: fechas.diaDeLaSemana(fecha),
      laborable,
      limite: parametros.limiteDiario,
      ocupacion,
      disponibles: laborable ? Math.max(parametros.limiteDiario - ocupacion, 0) : 0,
      citas: citasPorFecha.get(fecha) ?? [],
    });
  }

  return {
    vista,
    rango: { desde, hasta },
    limite_diario: parametros.limiteDiario,
    total_citas: citas.length,
    dias,
  };
}

/**
 * Añade a cada cita los datos que la agenda debe mostrar y que dependen de
 * reglas de negocio (requisito 17).
 */
function decorarCita(cita) {
  return {
    ...cita,
    hora_texto: fechas.horaAFormatoLocal(String(cita.hora)),
    fecha_texto: fechas.aFormatoLocal(cita.fecha),
    vencimiento_texto: fechas.aFormatoLocal(cita.fecha_vencimiento),
    dias_para_vencer: ordenService.diasParaVencer(cita.fecha_vencimiento, cita.fecha),
  };
}

/**
 * ¿Hay que llamar por teléfono a este paciente?
 *
 * Sí en dos casos: cuando se sabe que su número no tiene WhatsApp, y cuando el
 * recordatorio se intentó y falló. En ambos, el aviso automático no va a llegar
 * y alguien tiene que descolgar el teléfono.
 *
 * Que el recordatorio aún no haya salido no cuenta: todavía puede llegar solo.
 */
function necesitaLlamada(cita) {
  return cita.paciente_tiene_whatsapp === 0 || cita.recordatorio_estado === 'FALLIDO';
}

/**
 * Datos del panel principal (requisito 9).
 *
 * Se mira un día hacia cada lado: mañana, para preparar y avisar; ayer, para
 * cerrar lo que quedó pendiente de marcar. Más allá de eso está la agenda.
 */
async function obtenerResumen() {
  const hoy = fechas.hoy();
  const manana = fechas.sumarDias(hoy, 1);
  const ayer = fechas.sumarDias(hoy, -1);

  const [estadoHoy, citasHoy, citasManana, citasAyer, ordenesPorVencer] = await Promise.all([
    disponibilidadService.evaluarDia(hoy),
    citaModel.listarPorRango({ desde: hoy, hasta: hoy, incluirCanceladas: false }),
    citaModel.listarPorRango({ desde: manana, hasta: manana, incluirCanceladas: false }),
    // Las de ayer sí incluyen canceladas: es la revisión de lo que pasó.
    citaModel.listarPorRango({ desde: ayer, hasta: ayer, incluirCanceladas: true }),
    ordenService.listarPorVencer({ dias: 15 }),
  ]);

  const deManana = citasManana.map((cita) => ({
    ...decorarCita(cita),
    necesita_llamada: necesitaLlamada(cita),
  }));

  return {
    fecha: hoy,
    citas_hoy: citasHoy.map(decorarCita),
    pacientes_programados: estadoHoy.ocupacion,
    capacidad_diaria: estadoHoy.limite,
    espacios_disponibles: estadoHoy.disponibles,
    citas_manana: deManana,
    llamadas_pendientes: deManana.filter((cita) => cita.necesita_llamada).length,
    citas_ayer: citasAyer.map(decorarCita),
    ordenes_por_vencer: ordenesPorVencer.slice(0, 10),
  };
}

module.exports = {
  VISTAS,
  calcularRango,
  obtenerVista,
  obtenerResumen,
  decorarCita,
  necesitaLlamada,
};
