/**
 * Reglas de negocio de las órdenes del IGSS.
 *
 * Aquí vive la ÚNICA definición del cálculo de vencimiento y de la regla de
 * vigencia. Ningún otro archivo debe volver a calcular estas fechas: el
 * frontend las muestra y las citas las consultan desde aquí.
 */
const ordenModel = require('../models/orden.model');
const pacienteService = require('./paciente.service');
const examenService = require('./examen.service');
const configuracionService = require('./configuracion.service');
const AppError = require('../utils/AppError');
const fechas = require('../utils/fechas');

/**
 * Fecha de vencimiento de una orden.
 *
 *   Entrega: 10/08/2026  →  Vencimiento: 10/11/2026
 *
 * Si el día no existe en el mes destino se usa el último día de ese mes
 * (30/11 + 3 meses = 28/02), porque el 30 de febrero no existe.
 *
 * @param {string} fechaEntrega 'YYYY-MM-DD'
 * @param {number} mesesVigencia Meses de vigencia (3 por defecto, configurable).
 * @returns {string} 'YYYY-MM-DD'
 */
function calcularVencimiento(fechaEntrega, mesesVigencia) {
  const entrega = fechas.aISO(fechaEntrega);

  if (!entrega) {
    throw AppError.badRequest('La fecha de entrega no es una fecha válida.');
  }

  return fechas.sumarMeses(entrega, mesesVigencia);
}

/** Meses de vigencia configurados para el laboratorio. */
async function mesesDeVigencia() {
  return configuracionService.obtener(configuracionService.CLAVES.VIGENCIA_MESES);
}

/**
 * REGLA PRINCIPAL DE VIGENCIA (requisito 13).
 * Una cita solo es válida si su fecha es MENOR O IGUAL a la de vencimiento.
 * El propio día del vencimiento es válido.
 *
 * @returns {boolean}
 */
function fechaDentroDeVigencia(fechaCita, fechaVencimiento) {
  return fechas.comparar(fechaCita, fechaVencimiento) <= 0;
}

/** Días que faltan para que la orden venza (negativo si ya venció). */
function diasParaVencer(fechaVencimiento, desde = fechas.hoy()) {
  return fechas.diferenciaEnDias(desde, fechaVencimiento);
}

async function obtener(id) {
  const orden = await ordenModel.buscarPorId(id);
  if (!orden) throw AppError.notFound('La orden no existe.');
  return { ...orden, dias_para_vencer: diasParaVencer(orden.fecha_vencimiento) };
}

async function listarPorPaciente(pacienteId) {
  await pacienteService.obtener(pacienteId);

  const ordenes = await ordenModel.listarPorPaciente(pacienteId);

  return ordenes.map((orden) => ({
    ...orden,
    dias_para_vencer: diasParaVencer(orden.fecha_vencimiento),
    vigente: fechaDentroDeVigencia(fechas.hoy(), orden.fecha_vencimiento),
  }));
}

/** Órdenes que vencen dentro de los próximos N días y aún no tienen cita. */
async function listarPorVencer({ dias = 30 } = {}) {
  const desde = fechas.hoy();
  const hasta = fechas.sumarDias(desde, Math.min(Math.max(Number(dias) || 30, 1), 365));

  const ordenes = await ordenModel.listarPorVencer({ desde, hasta });

  return ordenes.map((orden) => ({
    ...orden,
    dias_para_vencer: diasParaVencer(orden.fecha_vencimiento, desde),
  }));
}

async function crear({ pacienteId, numeroOrden, fechaEntrega, examenes, observaciones }, idUsuario) {
  await pacienteService.obtener(pacienteId);

  const entrega = fechas.aISO(fechaEntrega);
  if (!entrega) throw AppError.badRequest('La fecha de entrega no es una fecha válida.');

  // Una orden entregada en el futuro sería un error de captura.
  if (fechas.comparar(entrega, fechas.hoy()) > 0) {
    throw AppError.badRequest('La fecha de entrega no puede ser posterior a hoy.');
  }

  const examenesValidados = await examenService.validarSeleccion(examenes);
  const vencimiento = calcularVencimiento(entrega, await mesesDeVigencia());

  const orden = await ordenModel.crear({
    pacienteId,
    numeroOrden: numeroOrden?.trim() || null,
    fechaEntrega: entrega,
    fechaVencimiento: vencimiento,
    observaciones: observaciones?.trim() || null,
    examenes: examenesValidados,
    creadoPor: idUsuario ?? null,
  });

  const dias = diasParaVencer(vencimiento);

  return {
    orden: { ...orden, dias_para_vencer: dias },
    avisos:
      dias < 0
        ? ['La orden ya está vencida: no se le podrán programar citas.']
        : dias <= 7
          ? [`La orden vence en ${dias} día(s). Conviene agendar la cita cuanto antes.`]
          : [],
  };
}

async function actualizar(id, { numeroOrden, fechaEntrega, examenes, observaciones }) {
  const existente = await obtener(id);

  const cambios = { numeroOrden, observaciones };

  if (fechaEntrega !== undefined) {
    const entrega = fechas.aISO(fechaEntrega);
    if (!entrega) throw AppError.badRequest('La fecha de entrega no es una fecha válida.');

    if (fechas.comparar(entrega, fechas.hoy()) > 0) {
      throw AppError.badRequest('La fecha de entrega no puede ser posterior a hoy.');
    }

    cambios.fechaEntrega = entrega;
    // El vencimiento SIEMPRE se recalcula: nunca se acepta del cliente.
    cambios.fechaVencimiento = calcularVencimiento(entrega, await mesesDeVigencia());

    // Si ya hay citas agendadas, acortar la vigencia podría dejarlas fuera.
    if (await ordenModel.contarCitasActivas(id) > 0) {
      const { citasFueraDeVigencia } = await revisarCitasContraVencimiento(
        id,
        cambios.fechaVencimiento,
      );

      if (citasFueraDeVigencia > 0) {
        throw AppError.conflict(
          'La nueva fecha de entrega dejaría fuera de vigencia a citas ya programadas. ' +
            'Reprograme o cancele esas citas antes de cambiar la fecha.',
        );
      }
    }
  }

  if (examenes !== undefined) {
    cambios.examenes = await examenService.validarSeleccion(examenes);
  }

  if (numeroOrden !== undefined) cambios.numeroOrden = numeroOrden?.trim() || null;
  if (observaciones !== undefined) cambios.observaciones = observaciones?.trim() || null;

  const actualizada = await ordenModel.actualizar(existente.id, cambios);

  return { ...actualizada, dias_para_vencer: diasParaVencer(actualizada.fecha_vencimiento) };
}

/** Cuenta las citas activas de una orden que quedarían fuera de un vencimiento dado. */
async function revisarCitasContraVencimiento(ordenId, fechaVencimiento) {
  // Se importa aquí para evitar una dependencia circular entre servicios.
  const citaModel = require('../models/cita.model');
  const citas = await citaModel.listarPorOrden(ordenId, { soloActivas: true });

  const citasFueraDeVigencia = citas.filter(
    (cita) => !fechaDentroDeVigencia(cita.fecha, fechaVencimiento),
  ).length;

  return { citasFueraDeVigencia };
}

module.exports = {
  calcularVencimiento,
  fechaDentroDeVigencia,
  diasParaVencer,
  mesesDeVigencia,
  obtener,
  listarPorPaciente,
  listarPorVencer,
  crear,
  actualizar,
};
