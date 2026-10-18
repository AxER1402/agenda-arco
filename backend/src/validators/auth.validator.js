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

/**
 * La credencial de Google es un JWT de un par de kilobytes. El tope solo evita
 * que alguien haga trabajar al verificador con un cuerpo enorme.
 */
const reglasLoginGoogle = [
  body('credencial')
    .isString()
    .withMessage('Falta la credencial de Google.')
    .bail()
    .notEmpty()
    .withMessage('Falta la credencial de Google.')
    .isLength({ max: 4096 })
    .withMessage('La credencial de Google no es válida.'),
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

module.exports = { reglasLogin, reglasLoginGoogle, reglasCambioContrasena, MIN_CONTRASENA };
