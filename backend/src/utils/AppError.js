/**
 * Error de negocio con código HTTP.
 * Los servicios lanzan AppError y el middleware de errores lo traduce a una
 * respuesta JSON. Cualquier otro error se reporta como 500 sin exponer detalles.
 */
class AppError extends Error {
  /**
   * @param {string} message  Mensaje entendible para el usuario final.
   * @param {number} statusCode Código HTTP.
   * @param {object} [details] Información adicional (p. ej. fechas sugeridas).
   */
  constructor(message, statusCode = 400, details = undefined) {
    super(message);
    this.name = 'AppError';
    this.statusCode = statusCode;
    this.details = details;
    this.isOperational = true;
    Error.captureStackTrace(this, this.constructor);
  }

  static badRequest(message, details) {
    return new AppError(message, 400, details);
  }

  static unauthorized(message = 'Credenciales inválidas.') {
    return new AppError(message, 401);
  }

  static forbidden(message = 'No tiene permisos para realizar esta acción.') {
    return new AppError(message, 403);
  }

  static notFound(message = 'Recurso no encontrado.') {
    return new AppError(message, 404);
  }

  static conflict(message, details) {
    return new AppError(message, 409, details);
  }

  static unprocessable(message, details) {
    return new AppError(message, 422, details);
  }
}

module.exports = AppError;
