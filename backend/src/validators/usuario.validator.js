const { body, param } = require('express-validator');
const { validar } = require('./validar');
const { MIN_CONTRASENA } = require('./auth.validator');
const { TODOS_LOS_ROLES } = require('../utils/roles');

const reglaId = param('id').isInt({ min: 1 }).withMessage('El identificador no es válido.');

const reglasCrear = [
  body('nombreCompleto')
    .trim()
    .notEmpty()
    .withMessage('El nombre completo es obligatorio.')
    .isLength({ max: 120 })
    .withMessage('El nombre completo no puede exceder 120 caracteres.'),
  body('usuario')
    .trim()
    .notEmpty()
    .withMessage('El nombre de acceso es obligatorio.')
    .isLength({ min: 4, max: 50 })
    .withMessage('El nombre de acceso debe tener entre 4 y 50 caracteres.')
    .matches(/^[a-zA-Z0-9._-]+$/)
    .withMessage('El nombre de acceso solo admite letras, números, punto, guion y guion bajo.'),
  body('contrasena')
    .isLength({ min: MIN_CONTRASENA })
    .withMessage(`La contraseña debe tener al menos ${MIN_CONTRASENA} caracteres.`),
  body('rol')
    .isIn(TODOS_LOS_ROLES)
    .withMessage(`El rol debe ser uno de: ${TODOS_LOS_ROLES.join(', ')}.`),
  validar,
];

const reglasActualizar = [
  reglaId,
  body('nombreCompleto')
    .optional()
    .trim()
    .notEmpty()
    .withMessage('El nombre completo no puede quedar vacío.')
    .isLength({ max: 120 })
    .withMessage('El nombre completo no puede exceder 120 caracteres.'),
  body('usuario')
    .optional()
    .trim()
    .isLength({ min: 4, max: 50 })
    .withMessage('El nombre de acceso debe tener entre 4 y 50 caracteres.')
    .matches(/^[a-zA-Z0-9._-]+$/)
    .withMessage('El nombre de acceso solo admite letras, números, punto, guion y guion bajo.'),
  body('rol')
    .optional()
    .isIn(TODOS_LOS_ROLES)
    .withMessage(`El rol debe ser uno de: ${TODOS_LOS_ROLES.join(', ')}.`),
  // toBoolean() convierte "false"/"0" en el booleano real. Sin esto, la cadena
  // llegaría al UPDATE y MySQL rechazaría el valor en la columna BOOLEAN.
  body('activo')
    .optional()
    .isBoolean()
    .withMessage('El estado activo debe ser verdadero o falso.')
    .toBoolean(),
  validar,
];

const reglasRestablecerContrasena = [
  reglaId,
  body('contrasenaNueva')
    .isLength({ min: MIN_CONTRASENA })
    .withMessage(`La contraseña debe tener al menos ${MIN_CONTRASENA} caracteres.`),
  validar,
];

const reglasObtener = [reglaId, validar];

module.exports = {
  reglasCrear,
  reglasActualizar,
  reglasRestablecerContrasena,
  reglasObtener,
};
