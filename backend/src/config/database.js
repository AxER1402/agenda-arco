/**
 * Pool de conexiones a MySQL.
 * Se exporta el pool y helpers finos; los repositorios/servicios construyen
 * sus consultas encima de esto.
 */
const mysql = require('mysql2/promise');
const env = require('./env');

let pool = null;

function getPool() {
  if (!pool) {
    pool = mysql.createPool({
      host: env.db.host,
      port: env.db.port,
      database: env.db.name,
      user: env.db.user,
      password: env.db.password,
      waitForConnections: true,
      connectionLimit: env.db.connectionLimit,
      queueLimit: 0,
      // Explícito: los nombres de pacientes y exámenes llevan tildes y ñ.
      charset: 'utf8mb4_unicode_ci',
      // Las fechas se manejan como cadenas 'YYYY-MM-DD' para que la zona
      // horaria del proceso nunca desplace un día calendario. La vigencia de
      // las órdenes se evalúa por día, no por instante.
      dateStrings: ['DATE', 'DATETIME'],
      timezone: 'Z',
      namedPlaceholders: true,
    });
  }
  return pool;
}

/** Ejecuta una consulta y devuelve solo las filas. */
async function query(sql, params = {}) {
  const [rows] = await getPool().execute(sql, params);
  return rows;
}

/** Ejecuta una consulta y devuelve la primera fila o null. */
async function queryOne(sql, params = {}) {
  const rows = await query(sql, params);
  return rows.length > 0 ? rows[0] : null;
}

/**
 * Ejecuta un callback dentro de una transacción.
 * Indispensable para operaciones como "crear cita + validar cupo del día",
 * donde dos usuarios podrían competir por el último espacio.
 */
async function withTransaction(callback) {
  const connection = await getPool().getConnection();
  try {
    await connection.beginTransaction();
    const result = await callback(connection);
    await connection.commit();
    return result;
  } catch (error) {
    await connection.rollback();
    throw error;
  } finally {
    connection.release();
  }
}

/** Verifica que la base responda. Usado por el endpoint de salud. */
async function ping() {
  const connection = await getPool().getConnection();
  try {
    await connection.ping();
    return true;
  } finally {
    connection.release();
  }
}

async function closePool() {
  if (pool) {
    await pool.end();
    pool = null;
  }
}

module.exports = { getPool, query, queryOne, withTransaction, ping, closePool };
