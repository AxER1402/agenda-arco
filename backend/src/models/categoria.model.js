const { query, queryOne } = require('../config/database');

/** Cada categoría trae cuántos exámenes la usan: la pantalla lo enseña. */
const CAMPOS = `
  c.id, c.nombre, c.indicaciones, c.creado_en,
  (SELECT COUNT(*) FROM examenes e WHERE e.categoria_id = c.id) AS total_examenes
`;

async function buscarPorId(id) {
  return queryOne(`SELECT ${CAMPOS} FROM categorias_examen c WHERE c.id = :id`, { id });
}

async function buscarPorNombre(nombre, excluirId = null) {
  return queryOne(
    `SELECT ${CAMPOS} FROM categorias_examen c
      WHERE c.nombre = :nombre AND (:excluirId IS NULL OR c.id <> :excluirId)`,
    { nombre, excluirId },
  );
}

async function listar() {
  return query(`SELECT ${CAMPOS} FROM categorias_examen c ORDER BY c.nombre`);
}

async function crear({ nombre, indicaciones = null }) {
  const resultado = await query(
    'INSERT INTO categorias_examen (nombre, indicaciones) VALUES (:nombre, :indicaciones)',
    { nombre, indicaciones },
  );
  return buscarPorId(resultado.insertId);
}

async function actualizar(id, cambios) {
  const columnas = { nombre: 'nombre', indicaciones: 'indicaciones' };
  const asignaciones = [];
  const parametros = { id };

  Object.entries(cambios).forEach(([clave, valor]) => {
    if (valor === undefined || !columnas[clave]) return;
    asignaciones.push(`${columnas[clave]} = :${clave}`);
    parametros[clave] = valor;
  });

  if (asignaciones.length > 0) {
    await query(`UPDATE categorias_examen SET ${asignaciones.join(', ')} WHERE id = :id`, parametros);
  }

  return buscarPorId(id);
}

/** Los exámenes de la categoría se quedan sin ella (ON DELETE SET NULL). */
async function eliminar(id) {
  await query('DELETE FROM categorias_examen WHERE id = :id', { id });
}

module.exports = { buscarPorId, buscarPorNombre, listar, crear, actualizar, eliminar };
