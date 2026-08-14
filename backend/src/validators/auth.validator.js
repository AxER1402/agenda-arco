const { body } = require('express-validator');
const { validar } = require('./validar');

/** Longitud mínima de contraseña para todo el sistema. */
const MIN_CONTRASENA = 8;

const reglasLogin = [
  body('usuario')
    .trim()
    .notEmpty()
    .withMessage('El usuario es obligatorio.')
    .isLength({ max: 50 })
    .withMessage('El usuario no puede exceder 50 caracteres.'),
  body('contrasena').notEmpty().withMessage('La contraseña es obligatoria.'),
  validar,
];

const reglasCambioContrasena = [
  body('contrasenaActual').notEmpty().withMessage('Debe indicar su contraseña actual.'),
  body('contrasenaNueva')
    .isLength({ min: MIN_CONTRASENA })
    .withMessage(`La nueva contraseña debe tener al menos ${MIN_CONTRASENA} caracteres.`)
    .custom((valor, { req }) => valor !== req.body.contrasenaActual)
    .withMessage('La nueva contraseña debe ser distinta de la actual.'),
  validar,
];

module.exports = { reglasLogin, reglasCambioContrasena, MIN_CONTRASENA };
