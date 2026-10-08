const { query, queryOne } = require('../config/database');

const CAMPOS = 'id, codigo, nombre, descripcion, indicaciones, activo, creado_en';

async function buscarPorId(id) {
  return queryOne(`SELECT ${CAMPOS} FROM examenes WHERE id = :id`, { id });
}

async function buscarPorCodigo(codigo, excluirId = null) {
  return queryOne(
    `SELECT ${CAMPOS} FROM examenes
      WHERE codigo = :codigo AND (:excluirId IS NULL OR id <> :excluirId)`,
    { codigo, excluirId },
  );
}

async function listar({ termino = '', incluirInactivos = false } = {}) {
  return query(
    `SELECT ${CAMPOS}
       FROM examenes
      WHERE (:incluirInactivos = 1 OR activo = 1)
        AND (:termino = '' OR nombre LIKE :like OR codigo LIKE :like)
      ORDER BY nombre`,
    {
      termino: termino.trim(),
      like: `%${termino.trim()}%`,
      incluirInactivos: incluirInactivos ? 1 : 0,
    },
  );
}

/** Comprueba que todos los identificadores existan y estén activos. */
async function listarPorIds(ids) {
  if (!Array.isArray(ids) || ids.length === 0) return [];

  // Los identificadores se fuerzan a entero antes de interpolarlos: IN (...)
  // no admite un número variable de parámetros preparados.
  const enteros = ids.map((id) => Number.parseInt(id, 10)).filter(Number.isInteger);
  if (enteros.length === 0) return [];

  return query(`SELECT ${CAMPOS} FROM examenes WHERE id IN (${enteros.join(',')})`);
}

async function crear({ codigo, nombre, descripcion = null, indicaciones = null }) {
  const resultado = await query(
    `INSERT INTO examenes (codigo, nombre, descripcion, indicaciones)
     VALUES (:codigo, :nombre, :descripcion, :indicaciones)`,
    { codigo, nombre, descripcion, indicaciones },
  );
  return buscarPorId(resultado.insertId);
}

async function actualizar(id, cambios) {
  const columnas = {
    codigo: 'codigo',
    nombre: 'nombre',
    descripcion: 'descripcion',
    indicaciones: 'indicaciones',
    activo: 'activo',
  };

  const asignaciones = [];
  const parametros = { id };

  Object.entries(cambios).forEach(([clave, valor]) => {
    if (valor === undefined || !columnas[clave]) return;
    asignaciones.push(`${columnas[clave]} = :${clave}`);
    parametros[clave] = valor;
  });

  if (asignaciones.length > 0) {
    await query(`UPDATE examenes SET ${asignaciones.join(', ')} WHERE id = :id`, parametros);
  }

  return buscarPorId(id);
}

/** Cuántas citas y órdenes tienen asignado el examen. */
async function contarUsos(id) {
  const fila = await queryOne(
    `SELECT (SELECT COUNT(*) FROM cita_examenes WHERE examen_id = :id) AS citas,
            (SELECT COUNT(*) FROM orden_examenes WHERE examen_id = :id) AS ordenes`,
    { id },
  );

  return { citas: Number(fila?.citas ?? 0), ordenes: Number(fila?.ordenes ?? 0) };
}

async function eliminar(id) {
  await query('DELETE FROM examenes WHERE id = :id', { id });
}

module.exports = {
  buscarPorId,
  buscarPorCodigo,
  listar,
  listarPorIds,
  contarUsos,
  crear,
  actualizar,
  eliminar,
};
