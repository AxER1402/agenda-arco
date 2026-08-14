const { validationResult } = require('express-validator');
const AppError = require('../utils/AppError');

/**
 * Middleware final de toda cadena de validación.
 * Convierte los errores de express-validator en un AppError 422 con el detalle
 * campo por campo, para que el frontend pueda señalar el input correcto.
 */
function validar(req, res, next) {
  const resultado = validationResult(req);

  if (resultado.isEmpty()) return next();

  const detalles = resultado.array().map((error) => ({
    campo: error.path,
    mensaje: error.msg,
  }));

  return next(AppError.unprocessable('Los datos enviados no son válidos.', detalles));
}

module.exports = { validar };
