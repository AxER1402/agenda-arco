const { ping } = require('../config/database');

/** Salud del proceso. No toca la base: sirve para saber si la API está viva. */
function getStatus(req, res) {
  res.status(200).json({
    estado: 'ok',
    servicio: 'backend',
    hora: new Date().toISOString(),
  });
}

/** Salud de la dependencia de base de datos. */
async function getDatabaseStatus(req, res) {
  try {
    await ping();
    res.status(200).json({ estado: 'ok', base_de_datos: 'conectada' });
  } catch (error) {
    res.status(503).json({
      estado: 'error',
      base_de_datos: 'no disponible',
      mensaje: error.message,
    });
  }
}

module.exports = { getStatus, getDatabaseStatus };
