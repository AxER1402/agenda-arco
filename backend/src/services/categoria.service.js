/**
 * Categorías de exámenes (sangre, orina, heces...).
 *
 * Sirven para dar una indicación a todo un grupo de exámenes de una vez: el
 * ayuno de 12 horas se escribe en la categoría «Sangre» y le llega a cualquier
 * paciente con al menos un examen de esa categoría, una sola vez, aunque
 * traiga cinco.
 */
const categoriaModel = require('../models/categoria.model');
const AppError = require('../utils/AppError');

async function listar() {
  return categoriaModel.listar();
}

async function obtener(id) {
  const categoria = await categoriaModel.buscarPorId(id);
  if (!categoria) throw AppError.notFound('La categoría no existe.');
  return categoria;
}

async function crear({ nombre, indicaciones }) {
  const limpio = nombre.trim();

  if (await categoriaModel.buscarPorNombre(limpio)) {
    throw AppError.conflict('Ya existe una categoría con ese nombre.');
  }

  return categoriaModel.crear({ nombre: limpio, indicaciones: indicaciones?.trim() || null });
}

async function actualizar(id, { nombre, indicaciones }) {
  await obtener(id);
  const cambios = {};

  if (nombre !== undefined) {
    const limpio = nombre.trim();
    if (await categoriaModel.buscarPorNombre(limpio, id)) {
      throw AppError.conflict('Ya existe otra categoría con ese nombre.');
    }
    cambios.nombre = limpio;
  }

  if (indicaciones !== undefined) cambios.indicaciones = indicaciones?.trim() || null;

  return categoriaModel.actualizar(id, cambios);
}

/**
 * Borra la categoría. Sus exámenes no se tocan: solo quedan sin categoría, y
 * por tanto dejan de llevar su indicación en el recordatorio.
 */
async function eliminar(id) {
  await obtener(id);
  await categoriaModel.eliminar(id);
}

/** Comprueba que la categoría que se asigna a un examen exista. */
async function validarAsignacion(categoriaId) {
  if (categoriaId === undefined) return undefined;
  if (categoriaId === null || categoriaId === '') return null;

  const id = Number.parseInt(categoriaId, 10);
  if (!(await categoriaModel.buscarPorId(id))) {
    throw AppError.badRequest('La categoría elegida no existe.');
  }
  return id;
}

module.exports = { listar, obtener, crear, actualizar, eliminar, validarAsignacion };
