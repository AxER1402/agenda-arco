const { body, param, query } = require('express-validator');
const { validar } = require('./validar');
const { esTelefonoValido } = require('../utils/telefono');
const { esDpiOpcionalValido } = require('../utils/dpi');

const reglaId = param('id').isInt({ min: 1 }).withMessage('El identificador no es válido.');

const reglaTelefono = (campo) =>
  campo
    .custom(esTelefonoValido)
    .withMessage('El teléfono debe ser un número de Guatemala de 8 dígitos.');

// Tres respuestas posibles: sí, no, y null cuando todavía no se sabe.
const reglaTieneWhatsapp = body('tieneWhatsapp')
  .optional({ nullable: true })
  .isBoolean()
  .withMessage('El dato de WhatsApp debe ser verdadero o falso.')
  .toBoolean();

// El DPI puede venir vacío, pero si trae algo tiene que ser de 13 dígitos.
const reglaDpi = (campo) =>
  campo
    .optional({ values: 'falsy' })
    .custom(esDpiOpcionalValido)
    .withMessage('El DPI debe tener exactamente 13 dígitos.');

const reglasCrear = [
  body('nombreCompleto')
    .trim()
    .notEmpty()
    .withMessage('El nombre completo es obligatorio.')
    .isLength({ min: 3, max: 150 })
    .withMessage('El nombre completo debe tener entre 3 y 150 caracteres.'),
  reglaTelefono(body('telefono')),
  reglaDpi(body('dpi')),
  reglaTieneWhatsapp,
  body('notas').optional({ values: 'falsy' }).trim().isLength({ max: 255 })
    .withMessage('Las notas no pueden exceder 255 caracteres.'),
  validar,
];

const reglasActualizar = [
  reglaId,
  body('nombreCompleto')
    .optional()
    .trim()
    .isLength({ min: 3, max: 150 })
    .withMessage('El nombre completo debe tener entre 3 y 150 caracteres.'),
  reglaTelefono(body('telefono').optional()),
  reglaDpi(body('dpi')),
  reglaTieneWhatsapp,
  body('notas').optional({ values: 'null' }).trim().isLength({ max: 255 })
    .withMessage('Las notas no pueden exceder 255 caracteres.'),
  body('activo')
    .optional()
    .isBoolean()
    .withMessage('El estado activo debe ser verdadero o falso.')
    .toBoolean(),
  validar,
];

const reglasBuscar = [
  query('termino').optional().trim().isLength({ max: 100 })
    .withMessage('El término de búsqueda es demasiado largo.'),
  query('pagina').optional().isInt({ min: 1 }).withMessage('La página no es válida.'),
  query('porPagina').optional().isInt({ min: 1, max: 100 })
    .withMessage('El tamaño de página debe estar entre 1 y 100.'),
  validar,
];

const reglasObtener = [reglaId, validar];

const reglasPorTelefono = [reglaTelefono(param('telefono')), validar];

module.exports = {
  reglasCrear,
  reglasActualizar,
  reglasBuscar,
  reglasObtener,
  reglasPorTelefono,
};
