/**
 * Configuración del laboratorio (límite diario, horario, vigencia de órdenes).
 * Se guarda como pares clave/valor para no tener que migrar la base cada vez
 * que aparece un parámetro nuevo.
 */
const { query, queryOne } = require('../config/database');

async function obtenerTodas() {
  const filas = await query('SELECT clave, valor, descripcion, actualizado_en FROM configuracion');
  return filas;
}

async function obtener(clave) {
  return queryOne('SELECT clave, valor FROM configuracion WHERE clave = :clave', { clave });
}

async function establecer(clave, valor, actualizadoPor = null) {
  await query(
    `INSERT INTO configuracion (clave, valor, actualizado_por)
     VALUES (:clave, :valor, :actualizadoPor)
     ON DUPLICATE KEY UPDATE valor = :valor, actualizado_por = :actualizadoPor`,
    { clave, valor: String(valor), actualizadoPor },
  );

  return obtener(clave);
}

module.exports = { obtenerTodas, obtener, establecer };
