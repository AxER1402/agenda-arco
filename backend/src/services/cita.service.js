/**
 * Reglas de negocio de las citas.
 *
 * Las dos reglas críticas del sistema se aplican aquí y solo aquí:
 *   1. Vigencia: la fecha de la cita no puede superar el vencimiento de la orden.
 *   2. Límite diario: no se pueden agendar más pacientes de los configurados.
 *
 * Cuando una de las dos rechaza la operación, la respuesta incluye siempre
 * fechas alternativas válidas (requisitos 13 y 14).
 */
const citaModel = require('../models/cita.model');
const ordenService = require('./orden.service');
const ordenModel = require('../models/orden.model');
const examenService = require('./examen.service');
const pacienteService = require('./paciente.service');
const disponibilidadService = require('./disponibilidad.service');
const configuracionService = require('./configuracion.service');
const authService = require('./auth.service');
const AppError = require('../utils/AppError');
const fechas = require('../utils/fechas');

const ESTADOS = {
  PENDIENTE: 'PENDIENTE',
  CONFIRMADA: 'CONFIRMADA',
  ATENDIDA: 'ATENDIDA',
  CANCELADA: 'CANCELADA',
  NO_ASISTIO: 'NO_ASISTIO',
};

/**
 * Transiciones permitidas entre estados.
 * Una cita cancelada puede reactivarse (el paciente vuelve a llamar), pero al
 * hacerlo recupera su cupo: la fecha se revalida contra la vigencia de la orden
 * y el límite diario. Atendida y no asistió sí son definitivas: si el paciente
 * quiere volver, se crea una cita nueva y el historial conserva ambas.
 */
const TRANSICIONES = {
  [ESTADOS.PENDIENTE]: [ESTADOS.CONFIRMADA, ESTADOS.ATENDIDA, ESTADOS.NO_ASISTIO, ESTADOS.CANCELADA],
  [ESTADOS.CONFIRMADA]: [ESTADOS.ATENDIDA, ESTADOS.NO_ASISTIO, ESTADOS.CANCELADA],
  [ESTADOS.ATENDIDA]: [],
  [ESTADOS.CANCELADA]: [ESTADOS.PENDIENTE, ESTADOS.CONFIRMADA],
  [ESTADOS.NO_ASISTIO]: [],
};

/** Estados cuyo desenlace ya ocurrió: no se reprograman ni se editan. */
const INMUTABLES = [ESTADOS.ATENDIDA, ESTADOS.NO_ASISTIO];

const HORA_VALIDA = /^([01]\d|2[0-3]):[0-5]\d(:[0-5]\d)?$/;

async function estadoPorCodigo(codigo) {
  const estado = await citaModel.buscarEstadoPorCodigo(codigo);
  if (!estado) throw AppError.badRequest(`El estado "${codigo}" no existe.`);
  return estado;
}

function normalizarHora(hora) {
  if (typeof hora !== 'string' || !HORA_VALIDA.test(hora)) {
    throw AppError.badRequest('La hora debe tener el formato HH:MM.');
  }
  return hora.length === 5 ? `${hora}:00` : hora;
}

/**
 * Comprueba fecha, vigencia y cupo. Es el punto por el que pasan tanto la
 * creación como la reprogramación.
 *
 * @throws {AppError} con `detalles.fechas_sugeridas` cuando la fecha no sirve.
 */
async function validarFecha({ fecha, orden, excluirCita = null }) {
  const fechaISO = fechas.aISO(fecha);

  if (!fechaISO) {
    throw AppError.badRequest('La fecha de la cita no es una fecha válida.');
  }

  // 1. No se agenda en el pasado.
  if (fechas.comparar(fechaISO, fechas.hoy()) < 0) {
    throw AppError.badRequest('No se puede programar una cita en una fecha pasada.');
  }

  // 2. REGLA DE VIGENCIA. El día del vencimiento sí es válido.
  if (!ordenService.fechaDentroDeVigencia(fechaISO, orden.fecha_vencimiento)) {
    const sugeridas = await disponibilidadService.sugerirFechasParaOrden(orden);

    throw AppError.unprocessable(
      `La fecha seleccionada supera la vigencia de la orden, que vence el ` +
        `${fechas.aFormatoLocal(orden.fecha_vencimiento)}.`,
      {
        motivo: 'FUERA_DE_VIGENCIA',
        fecha_vencimiento: orden.fecha_vencimiento,
        fechas_sugeridas: sugeridas,
        ...(sugeridas.length === 0
          ? {
              nota:
                'No quedan fechas con disponibilidad dentro de la vigencia. ' +
                'El paciente necesita una orden nueva.',
            }
          : {}),
      },
    );
  }

  // 2b. Antes de la cita del IGSS: los resultados tienen que estar para ella.
  const limite = ordenService.fechaLimiteCita(orden);

  if (limite.motivo === 'CITA_IGSS' && fechas.comparar(fechaISO, limite.fecha) > 0) {
    throw AppError.unprocessable(
      `El paciente tiene cita en el IGSS el ${fechas.aFormatoLocal(orden.fecha_cita_igss)}: ` +
        `la del laboratorio tiene que ser a más tardar el ${fechas.aFormatoLocal(limite.fecha)}.`,
      {
        motivo: 'DESPUES_DE_CITA_IGSS',
        fecha_limite: limite.fecha,
        fechas_sugeridas: await disponibilidadService.sugerirFechasParaOrden(orden),
      },
    );
  }

  const parametros = await disponibilidadService.obtenerParametros();

  // 3. Día laborable: de la semana de atención y sin feriado.
  if (
    !disponibilidadService.esDiaLaborable(fechaISO, parametros.diasLaborables, parametros.feriados)
  ) {
    const feriado = configuracionService.feriadoEn(fechaISO, parametros.feriados);

    throw AppError.unprocessable(
      feriado
        ? `El ${fechas.aFormatoLocal(fechaISO)} es feriado` +
            `${feriado.descripcion ? ` (${feriado.descripcion})` : ''}: el laboratorio no atiende.`
        : 'El laboratorio no atiende ese día.',
      {
        motivo: feriado ? 'DIA_FERIADO' : 'DIA_NO_LABORABLE',
        fechas_sugeridas: await disponibilidadService.sugerirFechasParaOrden(orden, {
          excluirFechas: [fechaISO],
        }),
      },
    );
  }

  // 4. LÍMITE DIARIO. Al reprogramar dentro del mismo día, la propia cita no
  //    debe contarse dos veces.
  const ocupacion = await citaModel.contarOcupacion(fechaISO);
  const yaOcupaEsteDia = excluirCita?.fecha === fechaISO && Boolean(excluirCita?.ocupa_cupo);
  const ocupacionEfectiva = yaOcupaEsteDia ? ocupacion - 1 : ocupacion;

  if (ocupacionEfectiva >= parametros.limiteDiario) {
    throw AppError.conflict(
      `El ${fechas.aFormatoLocal(fechaISO)} ya alcanzó el límite de ` +
        `${parametros.limiteDiario} pacientes.`,
      {
        motivo: 'LIMITE_DIARIO_ALCANZADO',
        limite: parametros.limiteDiario,
        ocupacion: ocupacionEfectiva,
        fechas_sugeridas: await disponibilidadService.sugerirFechasParaOrden(orden, {
          excluirFechas: [fechaISO],
        }),
      },
    );
  }

  return { fechaISO, parametros, ocupacion: ocupacionEfectiva };
}

/**
 * Comprobación de cupo que corre ya dentro de la transacción, con las filas del
 * día bloqueadas: entre la validación previa y el INSERT/UPDATE otro usuario
 * puede haber tomado el último espacio.
 *
 * @param {object|null} citaQueYaOcupa Cita que ya cuenta en ese día y que, por
 *   tanto, no debe contarse dos veces.
 */
function verificadorDeCupo(fechaISO, limiteDiario, citaQueYaOcupa = null) {
  return (ocupacionEnTransaccion) => {
    const yaContada = citaQueYaOcupa?.fecha === fechaISO && Boolean(citaQueYaOcupa?.ocupa_cupo);
    const efectiva = yaContada ? ocupacionEnTransaccion - 1 : ocupacionEnTransaccion;

    if (efectiva >= limiteDiario) {
      throw AppError.conflict(
        `El ${fechas.aFormatoLocal(fechaISO)} acaba de alcanzar el límite de ` +
          `${limiteDiario} pacientes. Elija otra fecha.`,
        { motivo: 'LIMITE_DIARIO_ALCANZADO', limite: limiteDiario },
      );
    }
  };
}

/** Los exámenes de la cita deben pertenecer a la orden. */
function resolverExamenes(orden, seleccion) {
  const disponibles = orden.examenes.map((examen) => examen.id);

  if (seleccion === undefined || seleccion === null || seleccion.length === 0) {
    return disponibles;
  }

  const elegidos = [...new Set(seleccion.map((id) => Number.parseInt(id, 10)))];
  const ajeno = elegidos.find((id) => !disponibles.includes(id));

  if (ajeno !== undefined) {
    throw AppError.badRequest('Se seleccionó un examen que no pertenece a la orden.');
  }

  return elegidos;
}

/**
 * Exámenes de una cita que se está editando.
 *
 * A diferencia del alta, aquí se admiten exámenes que la orden no tenía: al
 * editar la cita se descubre el examen que se olvidó al recibirla, y el papel
 * del IGSS es el mismo. Los nuevos se validan (que existan y estén activos) y
 * se agregan también a la orden, para que cita y orden sigan cuadrando. Los que
 * ya estaban en la orden se aceptan aunque luego se hayan desactivado.
 */
async function resolverExamenesAlEditar(orden, seleccion) {
  if (seleccion === undefined || seleccion === null || seleccion.length === 0) {
    return resolverExamenes(orden, seleccion);
  }

  const enOrden = orden.examenes.map((examen) => Number(examen.id));
  const elegidos = [...new Set(seleccion.map((id) => Number.parseInt(id, 10)))];
  const nuevos = elegidos.filter((id) => !enOrden.includes(id));

  if (nuevos.length > 0) {
    await examenService.validarSeleccion(nuevos);
    await ordenModel.actualizar(orden.id, { examenes: [...enOrden, ...nuevos] });
  }

  return elegidos;
}

async function obtener(id) {
  const cita = await citaModel.buscarPorId(id);
  if (!cita) throw AppError.notFound('La cita no existe.');
  return cita;
}

async function crear({ pacienteId, ordenId, fecha, hora, examenes, notas }, idUsuario) {
  const paciente = await pacienteService.obtener(pacienteId);

  if (!paciente.activo) {
    throw AppError.badRequest('El paciente está inactivo.');
  }

  const orden = await ordenService.obtener(ordenId);

  if (Number(orden.paciente_id) !== Number(pacienteId)) {
    throw AppError.badRequest('La orden no pertenece al paciente indicado.');
  }

  const { fechaISO, parametros } = await validarFecha({ fecha, orden });

  if (await citaModel.existeCitaActiva({ pacienteId, fecha: fechaISO })) {
    throw AppError.conflict('El paciente ya tiene una cita activa ese día.');
  }

  const estadoInicial = await estadoPorCodigo(ESTADOS.PENDIENTE);

  const cita = await citaModel.crear(
    {
      pacienteId,
      ordenId,
      estadoId: estadoInicial.id,
      fecha: fechaISO,
      hora: normalizarHora(hora),
      notas: notas?.trim() || null,
      examenes: resolverExamenes(orden, examenes),
      creadoPor: idUsuario ?? null,
    },
    verificadorDeCupo(fechaISO, parametros.limiteDiario),
  );

  const diasParaVencer = ordenService.diasParaVencer(orden.fecha_vencimiento, fechaISO);

  // Agendar cerca del vencimiento es lo normal (así se aprovecha la vigencia
  // completa), así que no se avisa de eso. Lo que sí importa es quedarse sin
  // margen: el mismo día del vencimiento no hay a dónde reprogramar.
  return {
    cita,
    avisos:
      diasParaVencer === 0
        ? [
            `La cita es el último día de vigencia de la orden ` +
              `(${fechas.aFormatoLocal(orden.fecha_vencimiento)}): si el paciente no asiste, ` +
              'no habrá margen para reprogramarla y necesitará una orden nueva.',
          ]
        : [],
  };
}

/**
 * Reprogramación: cambia fecha, hora, exámenes o notas.
 *
 * Una cita cancelada también se puede reagendar: al darle fecha u hora nuevas
 * vuelve a PENDIENTE y recupera su cupo, así que su fecha se revalida aunque
 * solo haya cambiado la hora.
 */
async function actualizar(id, { fecha, hora, examenes, notas }) {
  const cita = await obtener(id);

  if (INMUTABLES.includes(cita.estado)) {
    throw AppError.conflict(
      `La cita está ${cita.estado_nombre.toLowerCase()} y ya no puede modificarse.`,
    );
  }

  const orden = await ordenService.obtener(cita.orden_id);
  const cambios = {};
  let verificarCupo = null;

  const reagendar =
    cita.estado === ESTADOS.CANCELADA && (fecha !== undefined || hora !== undefined);

  // Al reagendar sin mover el día hay que validar igualmente la fecha actual:
  // la cita estaba cancelada y no contaba para el cupo de ese día.
  const fechaAValidar = fecha !== undefined ? fecha : reagendar ? cita.fecha : undefined;

  if (fechaAValidar !== undefined) {
    const { fechaISO, parametros } = await validarFecha({
      fecha: fechaAValidar,
      orden,
      excluirCita: cita,
    });

    if (
      (fechaISO !== cita.fecha || reagendar) &&
      (await citaModel.existeCitaActiva({
        pacienteId: cita.paciente_id,
        fecha: fechaISO,
        excluirId: cita.id,
      }))
    ) {
      throw AppError.conflict('El paciente ya tiene otra cita activa ese día.');
    }

    cambios.fecha = fechaISO;
    verificarCupo = verificadorDeCupo(fechaISO, parametros.limiteDiario, cita);
  }

  if (reagendar) {
    cambios.estadoId = (await estadoPorCodigo(ESTADOS.PENDIENTE)).id;
  }

  if (hora !== undefined) cambios.hora = normalizarHora(hora);
  if (notas !== undefined) cambios.notas = notas?.trim() || null;
  if (examenes !== undefined) cambios.examenes = await resolverExamenesAlEditar(orden, examenes);

  const actualizada = await citaModel.actualizar(id, cambios, verificarCupo);

  // Si la cita se movió, su recordatorio quedó obsoleto: el que ya salió lleva
  // el día viejo y el que estaba en cola saldría la víspera equivocada.
  const seMovio =
    (cambios.fecha !== undefined && cambios.fecha !== cita.fecha) ||
    (cambios.hora !== undefined && cambios.hora !== String(cita.hora));

  if (seMovio) {
    // Se importa aquí para no crear una dependencia circular entre servicios.
    const recordatorioService = require('./recordatorio.service');
    await recordatorioService.reprogramarParaCita(actualizada);
  }

  return actualizada;
}

/**
 * Cambio de estado: confirmar, marcar atendida, no asistió o cancelar.
 * Requisito 16.
 */
async function cambiarEstado(id, codigoEstado, { motivo } = {}) {
  const cita = await obtener(id);

  if (cita.estado === codigoEstado) {
    throw AppError.badRequest(`La cita ya está en estado "${cita.estado_nombre}".`);
  }

  const permitidos = TRANSICIONES[cita.estado] ?? [];

  if (!permitidos.includes(codigoEstado)) {
    throw AppError.conflict(
      `No se puede pasar de "${cita.estado_nombre}" a ese estado.`,
      { estado_actual: cita.estado, transiciones_permitidas: permitidos },
    );
  }

  const estado = await estadoPorCodigo(codigoEstado);

  const notas =
    codigoEstado === ESTADOS.CANCELADA && motivo?.trim()
      ? `${cita.notas ? `${cita.notas} | ` : ''}Cancelada: ${motivo.trim()}`.slice(0, 255)
      : undefined;

  // Reactivar una cita cancelada vuelve a ocupar un espacio del día (las
  // canceladas no cuentan): hay que comprobar que su fecha sigue siendo válida
  // y que ese día todavía tiene cupo.
  if (cita.estado === ESTADOS.CANCELADA) {
    const orden = await ordenService.obtener(cita.orden_id);
    const { fechaISO, parametros } = await validarFecha({
      fecha: cita.fecha,
      orden,
      excluirCita: cita,
    });

    if (
      await citaModel.existeCitaActiva({
        pacienteId: cita.paciente_id,
        fecha: fechaISO,
        excluirId: cita.id,
      })
    ) {
      throw AppError.conflict('El paciente ya tiene otra cita activa ese día.');
    }

    // La fecha se reenvía sin cambiarla para que el modelo bloquee las filas de
    // ese día y vuelva a contar la ocupación dentro de la transacción.
    return citaModel.actualizar(
      id,
      { estadoId: estado.id, notas, fecha: fechaISO },
      verificadorDeCupo(fechaISO, parametros.limiteDiario, cita),
    );
  }

  return citaModel.actualizar(id, { estadoId: estado.id, notas });
}

/**
 * Borrado definitivo de una cita.
 *
 * Lo normal es cancelar, que conserva el historial; esto es para las citas
 * creadas por error, que no deben ensuciar el registro del paciente.
 *
 * Exige la contraseña de quien tiene la sesión abierta. Es la única acción del
 * sistema que no se puede deshacer —la cancelada se reactiva, el paciente y el
 * examen se reactivan, esto no—, y en un mostrador la sesión se queda abierta.
 * La comprobación va aquí, en el servidor: un cuadro de diálogo del navegador
 * se salta con las herramientas de desarrollo.
 *
 * @param {number|string} id
 * @param {{usuarioId: number, contrasena: string}} confirmacion
 */
async function eliminar(id, { usuarioId, contrasena } = {}) {
  await authService.confirmarIdentidad(usuarioId, contrasena);

  const cita = await obtener(id);
  await citaModel.eliminar(cita.id);

  return { id: cita.id, eliminada: true };
}

/** Historial de citas de un paciente (requisito 12). */
async function historialDePaciente(pacienteId) {
  await pacienteService.obtener(pacienteId);
  return citaModel.listarPorPaciente(pacienteId);
}

async function listarEstados() {
  return citaModel.listarEstados();
}

module.exports = {
  ESTADOS,
  TRANSICIONES,
  INMUTABLES,
  validarFecha,
  obtener,
  crear,
  actualizar,
  cambiarEstado,
  eliminar,
  historialDePaciente,
  listarEstados,
};
