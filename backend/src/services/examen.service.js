const examenModel = require('../models/examen.model');
const AppError = require('../utils/AppError');

async function listar({ termino = '', incluirInactivos = false } = {}) {
  return examenModel.listar({ termino, incluirInactivos });
}

async function obtener(id) {
  const examen = await examenModel.buscarPorId(id);
  if (!examen) throw AppError.notFound('El examen no existe.');
  return examen;
}

async function crear({ codigo, nombre, descripcion, indicaciones }) {
  const codigoNormalizado = codigo.trim().toUpperCase();

  if (await examenModel.buscarPorCodigo(codigoNormalizado)) {
    throw AppError.conflict('Ya existe un examen con ese código.');
  }

  return examenModel.crear({
    codigo: codigoNormalizado,
    nombre: nombre.trim(),
    descripcion: descripcion?.trim() || null,
    indicaciones: indicaciones?.trim() || null,
  });
}

async function actualizar(id, { codigo, nombre, descripcion, indicaciones, activo }) {
  await obtener(id);

  const cambios = { activo };

  if (codigo !== undefined) {
    const codigoNormalizado = codigo.trim().toUpperCase();
    if (await examenModel.buscarPorCodigo(codigoNormalizado, id)) {
      throw AppError.conflict('Ya existe otro examen con ese código.');
    }
    cambios.codigo = codigoNormalizado;
  }

  if (nombre !== undefined) cambios.nombre = nombre.trim();
  if (descripcion !== undefined) cambios.descripcion = descripcion?.trim() || null;
  if (indicaciones !== undefined) cambios.indicaciones = indicaciones?.trim() || null;

  return examenModel.actualizar(id, cambios);
}

/**
 * Valida una lista de exámenes recibida del cliente.
 * @returns {Promise<number[]>} identificadores únicos y existentes.
 */
async function validarSeleccion(ids) {
  if (!Array.isArray(ids) || ids.length === 0) {
    throw AppError.badRequest('Debe seleccionar al menos un examen.');
  }

  const unicos = [...new Set(ids.map((id) => Number.parseInt(id, 10)))];
  const encontrados = await examenModel.listarPorIds(unicos);

  if (encontrados.length !== unicos.length) {
    throw AppError.badRequest('Uno o más exámenes seleccionados no existen.');
  }

  const inactivo = encontrados.find((examen) => !examen.activo);
  if (inactivo) {
    throw AppError.badRequest(`El examen "${inactivo.nombre}" está inactivo.`);
  }

  return unicos;
}

/**
 * Borra un examen del catálogo.
 *
 * Solo si nadie lo usa: si ya está en alguna cita u orden, borrarlo dejaría
 * esas citas sin saber qué se hizo —y la base lo impide de todos modos—. En
 * ese caso lo que corresponde es desactivarlo.
 */
async function eliminar(id) {
  const examen = await obtener(id);
  const { citas, ordenes } = await examenModel.contarUsos(id);

  if (citas > 0 || ordenes > 0) {
    throw AppError.conflict(
      `"${examen.nombre}" ya está asignado a ${citas} cita(s) y ${ordenes} orden(es), así que `
        + 'no se puede eliminar sin perder ese historial. Desactívelo para que no se asigne más.',
    );
  }

  await examenModel.eliminar(id);
}

module.exports = { listar, obtener, crear, actualizar, validarSeleccion, eliminar };
