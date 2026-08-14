/**
 * Recepción de un paciente en el mostrador.
 *
 * Es el flujo real del laboratorio: la persona llega con su orden del IGSS en
 * la mano y en una sola operación se resuelve todo — se le identifica por
 * teléfono (o se le registra si es la primera vez), se anota qué exámenes trae
 * y desde cuándo, y se le da fecha de cita.
 *
 * Por eso la orden del IGSS no existe antes de la cita: nace con ella.
 *
 * El orden de las operaciones es deliberado: TODO lo que puede fallar se
 * comprueba antes de escribir la primera fila, para no dejar a medias un
 * paciente sin orden o una orden sin cita. Aun así, si el último paso falla
 * (por ejemplo, otro usuario acaba de tomar el último espacio del día), se
 * deshace lo que se haya creado.
 */
const citaService = require('./cita.service');
const examenService = require('./examen.service');
const ordenService = require('./orden.service');
const pacienteService = require('./paciente.service');
const citaModel = require('../models/cita.model');
const ordenModel = require('../models/orden.model');
const pacienteModel = require('../models/paciente.model');
const AppError = require('../utils/AppError');
const fechas = require('../utils/fechas');

/**
 * Resuelve a quién se le agenda: un paciente ya registrado o uno nuevo.
 * No escribe nada; solo decide y valida.
 */
function prepararPaciente({ pacienteId, paciente }) {
  if (pacienteId) return { pacienteId: Number(pacienteId), datos: null };

  if (!paciente?.nombreCompleto?.trim()) {
    throw AppError.badRequest(
      'Indique a qué paciente se le agenda: su identificador, o el nombre y el teléfono si es nuevo.',
    );
  }

  return {
    pacienteId: null,
    datos: {
      nombreCompleto: paciente.nombreCompleto,
      telefono: paciente.telefono,
      // Se validan aquí, antes de crear nada, para que un DPI incompleto no
      // aparezca recién al final del formulario.
      dpi: pacienteService.prepararDpi(paciente.dpi),
      notas: paciente.notas,
    },
  };
}

/**
 * Lo que el paciente respondió en el mostrador sobre su WhatsApp.
 * Puede llegar suelto o dentro de los datos del paciente nuevo.
 */
function respuestaWhatsapp({ tieneWhatsapp, paciente }) {
  const respuesta = tieneWhatsapp ?? paciente?.tieneWhatsapp;
  return respuesta === undefined ? undefined : pacienteService.prepararTieneWhatsapp(respuesta);
}

/** MySQL devuelve 1/0/null; se compara contra true/false/null. */
function normalizarWhatsappGuardado(paciente) {
  return paciente.tiene_whatsapp === null || paciente.tiene_whatsapp === undefined
    ? null
    : Boolean(paciente.tiene_whatsapp);
}

/**
 * @param {object} datos
 * @param {number} [datos.pacienteId] Paciente ya registrado.
 * @param {object} [datos.paciente] Datos para registrarlo, si es nuevo.
 * @param {string} datos.fechaRecepcion Fecha en que el IGSS entregó la orden.
 * @param {number[]} datos.examenes Exámenes que trae el paciente.
 * @param {string} datos.fecha Día de la cita.
 * @param {string} datos.hora Hora de la cita.
 */
async function recibir(
  {
    pacienteId,
    paciente,
    tieneWhatsapp,
    fechaRecepcion,
    numeroOrden,
    examenes,
    fecha,
    hora,
    notas,
    observaciones,
  },
  idUsuario,
) {
  // 1. Validaciones que no tocan la base o que solo leen.
  const destinatario = prepararPaciente({ pacienteId, paciente });
  const whatsapp = respuestaWhatsapp({ tieneWhatsapp, paciente });
  const examenesValidados = await examenService.validarSeleccion(examenes);

  const recepcion = fechas.aISO(fechaRecepcion);
  if (!recepcion) {
    throw AppError.badRequest('La fecha de recepción no es una fecha válida.');
  }
  if (fechas.comparar(recepcion, fechas.hoy()) > 0) {
    throw AppError.badRequest('La fecha de recepción no puede ser posterior a hoy.');
  }

  const meses = await ordenService.mesesDeVigencia();
  const fechaVencimiento = ordenService.calcularVencimiento(recepcion, meses);

  // 2. La fecha de la cita se valida contra la orden que TODAVÍA no existe:
  //    vigencia, día laborable y cupo. Si falla, la respuesta ya trae fechas
  //    alternativas y no se ha escrito nada.
  await citaService.validarFecha({ fecha, orden: { fecha_vencimiento: fechaVencimiento } });

  const existente = destinatario.pacienteId
    ? await pacienteService.obtener(destinatario.pacienteId)
    : null;

  if (existente && !existente.activo) {
    throw AppError.badRequest('El paciente está inactivo.');
  }

  if (
    existente &&
    (await citaModel.existeCitaActiva({ pacienteId: existente.id, fecha: fechas.aISO(fecha) }))
  ) {
    throw AppError.conflict('El paciente ya tiene una cita activa ese día.');
  }

  // 3. A partir de aquí sí se escribe.
  const avisos = [];
  let pacienteFinal = existente;
  let ordenCreada = null;

  try {
    if (!pacienteFinal) {
      const registro = await pacienteService.crear({
        ...destinatario.datos,
        tieneWhatsapp: whatsapp,
      });
      pacienteFinal = registro.paciente;
      avisos.push(...registro.avisos);
    } else if (whatsapp !== undefined && whatsapp !== normalizarWhatsappGuardado(pacienteFinal)) {
      // El paciente ya estaba fichado, pero en el mostrador acaban de
      // confirmar (o desmentir) que ese número tiene WhatsApp.
      pacienteFinal = await pacienteService.actualizar(pacienteFinal.id, {
        tieneWhatsapp: whatsapp,
      });
    }

    const { orden, avisos: avisosOrden } = await ordenService.crear(
      {
        pacienteId: pacienteFinal.id,
        numeroOrden,
        fechaEntrega: recepcion,
        examenes: examenesValidados,
        observaciones,
      },
      idUsuario,
    );

    ordenCreada = orden;
    avisos.push(...avisosOrden);

    const { cita, avisos: avisosCita } = await citaService.crear(
      {
        pacienteId: pacienteFinal.id,
        ordenId: orden.id,
        fecha,
        hora,
        examenes: examenesValidados,
        notas,
      },
      idUsuario,
    );

    avisos.push(...avisosCita);

    return {
      cita,
      orden,
      paciente: pacienteFinal,
      paciente_registrado: !existente,
      avisos,
    };
  } catch (error) {
    // La cita es el objetivo de toda la operación: sin ella, la orden y el
    // paciente recién creados serían basura que nadie volvería a mirar.
    if (ordenCreada) await ordenModel.eliminar(ordenCreada.id);
    if (!existente && pacienteFinal) await pacienteModel.eliminar(pacienteFinal.id);

    throw error;
  }
}

module.exports = { recibir };
