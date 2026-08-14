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

async function crear({ codigo, nombre, descripcion }) {
  const codigoNormalizado = codigo.trim().toUpperCase();

  if (await examenModel.buscarPorCodigo(codigoNormalizado)) {
    throw AppError.conflict('Ya existe un examen con ese código.');
  }

  return examenModel.crear({
    codigo: codigoNormalizado,
    nombre: nombre.trim(),
    descripcion: descripcion?.trim() || null,
  });
}

async function actualizar(id, { codigo, nombre, descripcion, activo }) {
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

async function desactivar(id) {
  await obtener(id);
  return examenModel.actualizar(id, { activo: false });
}

module.exports = { listar, obtener, crear, actualizar, validarSeleccion, desactivar };
