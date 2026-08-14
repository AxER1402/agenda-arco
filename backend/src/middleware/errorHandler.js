const AppError = require('../utils/AppError');
const env = require('../config/env');

/** 404 para rutas no registradas. */
function notFound(req, res, next) {
  next(AppError.notFound(`Ruta no encontrada: ${req.method} ${req.originalUrl}`));
}

/**
 * Manejador central de errores.
 * Regla de seguridad: los errores no controlados nunca exponen su mensaje ni
 * el stack al cliente; se registran en el servidor y se responde genérico.
 */
// eslint-disable-next-line no-unused-vars
function errorHandler(error, req, res, next) {
  if (error instanceof AppError) {
    return res.status(error.statusCode).json({
      error: {
        mensaje: error.message,
        ...(error.details ? { detalles: error.details } : {}),
      },
    });
  }

  console.error('[error-no-controlado]', error);

  return res.status(500).json({
    error: {
      mensaje: 'Ocurrió un error interno. Intente nuevamente.',
      ...(env.isProduction ? {} : { debug: error.message }),
    },
  });
}

module.exports = { notFound, errorHandler };
