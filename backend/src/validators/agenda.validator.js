/**
 * Validadores de exámenes, órdenes, citas y agenda.
 */
const { body, param, query } = require('express-validator');
const { validar } = require('./validar');
const { esFechaValida } = require('../utils/fechas');
const { esTelefonoValido } = require('../utils/telefono');
const { esDpiOpcionalValido } = require('../utils/dpi');
const { ESTADOS } = require('../services/cita.service');

const CODIGOS_ESTADO = Object.values(ESTADOS);

const reglaId = param('id').isInt({ min: 1 }).withMessage('El identificador no es válido.');

const reglaFecha = (campo, nombre) =>
  campo.custom(esFechaValida).withMessage(`${nombre} debe tener el formato AAAA-MM-DD.`);

// --- Exámenes --------------------------------------------------------------

const examenCrear = [
  body('codigo').trim().notEmpty().withMessage('El código es obligatorio.')
    .isLength({ max: 30 }).withMessage('El código no puede exceder 30 caracteres.'),
  body('nombre').trim().notEmpty().withMessage('El nombre es obligatorio.')
    .isLength({ max: 150 }).withMessage('El nombre no puede exceder 150 caracteres.'),
  body('descripcion').optional({ values: 'falsy' }).trim().isLength({ max: 255 })
    .withMessage('La descripción no puede exceder 255 caracteres.'),
  validar,
];

const examenActualizar = [
  reglaId,
  body('codigo').optional().trim().notEmpty().withMessage('El código no puede quedar vacío.'),
  body('nombre').optional().trim().notEmpty().withMessage('El nombre no puede quedar vacío.'),
  body('descripcion').optional({ values: 'null' }).trim().isLength({ max: 255 })
    .withMessage('La descripción no puede exceder 255 caracteres.'),
  body('activo')
    .optional()
    .isBoolean()
    .withMessage('El estado activo debe ser verdadero o falso.')
    .toBoolean(),
  validar,
];

// --- Órdenes ---------------------------------------------------------------

const ordenCrear = [
  body('pacienteId').isInt({ min: 1 }).withMessage('Debe indicar un paciente válido.'),
  reglaFecha(body('fechaEntrega'), 'La fecha de entrega'),
  body('examenes').isArray({ min: 1 }).withMessage('Debe seleccionar al menos un examen.'),
  body('examenes.*').isInt({ min: 1 }).withMessage('Los exámenes seleccionados no son válidos.'),
  body('numeroOrden').optional({ values: 'falsy' }).trim().isLength({ max: 50 })
    .withMessage('El número de orden no puede exceder 50 caracteres.'),
  body('fechaCitaIgss').optional({ values: 'falsy' }).custom(esFechaValida)
    .withMessage('La fecha de la cita del IGSS debe tener el formato AAAA-MM-DD.'),
  body('observaciones').optional({ values: 'falsy' }).trim().isLength({ max: 255 })
    .withMessage('Las observaciones no pueden exceder 255 caracteres.'),
  validar,
];

const ordenActualizar = [
  reglaId,
  reglaFecha(body('fechaEntrega').optional(), 'La fecha de entrega'),
  body('fechaCitaIgss').optional({ values: 'null' }).custom((valor) => valor === '' || esFechaValida(valor))
    .withMessage('La fecha de la cita del IGSS debe tener el formato AAAA-MM-DD.'),
  body('examenes').optional().isArray({ min: 1 })
    .withMessage('Debe seleccionar al menos un examen.'),
  body('examenes.*').optional().isInt({ min: 1 })
    .withMessage('Los exámenes seleccionados no son válidos.'),
  body('observaciones').optional({ values: 'null' }).trim().isLength({ max: 255 })
    .withMessage('Las observaciones no pueden exceder 255 caracteres.'),
  validar,
];

const ordenVencimiento = [
  reglaFecha(query('fechaEntrega'), 'La fecha de entrega'),
  query('fechaCitaIgss').optional({ values: 'falsy' }).custom(esFechaValida)
    .withMessage('La fecha de la cita del IGSS debe tener el formato AAAA-MM-DD.'),
  validar,
];

// --- Citas -----------------------------------------------------------------

const citaCrear = [
  body('pacienteId').isInt({ min: 1 }).withMessage('Debe indicar un paciente válido.'),
  body('ordenId').isInt({ min: 1 }).withMessage('Debe indicar una orden válida.'),
  reglaFecha(body('fecha'), 'La fecha de la cita'),
  body('hora').matches(/^([01]\d|2[0-3]):[0-5]\d(:[0-5]\d)?$/)
    .withMessage('La hora debe tener el formato HH:MM.'),
  body('examenes').optional().isArray().withMessage('Los exámenes deben enviarse como lista.'),
  body('examenes.*').optional().isInt({ min: 1 })
    .withMessage('Los exámenes seleccionados no son válidos.'),
  body('notas').optional({ values: 'falsy' }).trim().isLength({ max: 255 })
    .withMessage('Las notas no pueden exceder 255 caracteres.'),
  validar,
];

/**
 * Recepción en el mostrador: paciente (existente o nuevo), orden y cita en una
 * sola petición. El paciente llega de una de las dos formas, nunca de las dos.
 */
const citaRecepcion = [
  body('pacienteId').optional().isInt({ min: 1 })
    .withMessage('El paciente indicado no es válido.'),
  body('paciente.nombreCompleto').optional().trim().isLength({ min: 3, max: 150 })
    .withMessage('El nombre completo debe tener entre 3 y 150 caracteres.'),
  body('paciente.telefono').optional().custom(esTelefonoValido)
    .withMessage('El teléfono debe ser un número de Guatemala de 8 dígitos.'),
  body('paciente.dpi').optional({ values: 'falsy' }).custom(esDpiOpcionalValido)
    .withMessage('El DPI debe tener exactamente 13 dígitos.'),
  // Lo que respondió el paciente sobre su WhatsApp. Si no lo saben, no se envía.
  body('tieneWhatsapp').optional({ nullable: true }).isBoolean()
    .withMessage('El dato de WhatsApp debe ser verdadero o falso.')
    .toBoolean(),
  body().custom((cuerpo) => {
    if (cuerpo.pacienteId) return true;
    if (cuerpo.paciente?.nombreCompleto && cuerpo.paciente?.telefono) return true;
    throw new Error('Indique el paciente, o su nombre y teléfono si es nuevo.');
  }),
  reglaFecha(body('fechaRecepcion'), 'La fecha de recepción'),
  reglaFecha(body('fecha'), 'La fecha de la cita'),
  body('hora').matches(/^([01]\d|2[0-3]):[0-5]\d(:[0-5]\d)?$/)
    .withMessage('La hora debe tener el formato HH:MM.'),
  body('examenes').isArray({ min: 1 }).withMessage('Debe seleccionar al menos un examen.'),
  body('examenes.*').isInt({ min: 1 }).withMessage('Los exámenes seleccionados no son válidos.'),
  body('fechaCitaIgss').optional({ values: 'falsy' }).custom(esFechaValida)
    .withMessage('La fecha de la cita del IGSS debe tener el formato AAAA-MM-DD.'),
  body('notas').optional({ values: 'falsy' }).trim().isLength({ max: 255 })
    .withMessage('Las notas no pueden exceder 255 caracteres.'),
  validar,
];

const citaActualizar = [
  reglaId,
  reglaFecha(body('fecha').optional(), 'La fecha de la cita'),
  body('hora').optional().matches(/^([01]\d|2[0-3]):[0-5]\d(:[0-5]\d)?$/)
    .withMessage('La hora debe tener el formato HH:MM.'),
  body('examenes').optional().isArray().withMessage('Los exámenes deben enviarse como lista.'),
  body('notas').optional({ values: 'null' }).trim().isLength({ max: 255 })
    .withMessage('Las notas no pueden exceder 255 caracteres.'),
  validar,
];

const citaEstado = [
  reglaId,
  body('estado').isIn(CODIGOS_ESTADO)
    .withMessage(`El estado debe ser uno de: ${CODIGOS_ESTADO.join(', ')}.`),
  body('motivo').optional({ values: 'falsy' }).trim().isLength({ max: 200 })
    .withMessage('El motivo no puede exceder 200 caracteres.'),
  validar,
];

const citaDisponibilidad = [reglaFecha(query('fecha'), 'La fecha'), validar];

const citaSugerencias = [
  reglaFecha(query('desde'), 'La fecha inicial'),
  reglaFecha(query('hasta'), 'La fecha final'),
  query('cantidad').optional().isInt({ min: 1, max: 10 })
    .withMessage('La cantidad de sugerencias debe estar entre 1 y 10.'),
  validar,
];

// --- Agenda ----------------------------------------------------------------

const agendaVista = [
  query('vista').optional().isIn(['dia', 'semana', 'mes'])
    .withMessage('La vista debe ser dia, semana o mes.'),
  reglaFecha(query('fecha').optional(), 'La fecha'),
  validar,
];

const configuracionActualizar = [
  body('limite_diario_pacientes').optional().isInt({ min: 1, max: 500 })
    .withMessage('El límite diario debe ser un entero entre 1 y 500.'),
  body('vigencia_orden_meses').optional().isInt({ min: 1, max: 24 })
    .withMessage('La vigencia debe ser un entero de meses entre 1 y 24.'),
  body('hora_apertura').optional().matches(/^([01]\d|2[0-3]):[0-5]\d$/)
    .withMessage('La hora de apertura debe tener el formato HH:MM.'),
  body('hora_cierre').optional().matches(/^([01]\d|2[0-3]):[0-5]\d$/)
    .withMessage('La hora de cierre debe tener el formato HH:MM.'),
  body('intervalo_citas_minutos').optional().isInt({ min: 5, max: 120 })
    .withMessage('El intervalo debe estar entre 5 y 120 minutos.'),
  body('hora_recordatorios').optional().matches(/^([01]\d|2[0-3]):[0-5]\d$/)
    .withMessage('La hora de los recordatorios debe tener el formato HH:MM.'),
  // Llegan como lista de números ISO: 1 es lunes y 7, domingo.
  body('dias_laborables').optional().isArray({ min: 1 })
    .withMessage('Debe marcar al menos un día de atención.'),
  body('dias_laborables.*').optional().isInt({ min: 1, max: 7 })
    .withMessage('Los días de atención deben ser números del 1 (lunes) al 7 (domingo).'),
  validar,
];

/**
 * Mensaje del recordatorio.
 * Aquí solo se comprueba la forma de la petición; que los marcadores existan y
 * que la imagen sea una imagen lo decide `configuracion.service`, que es donde
 * está declarado qué admite cada parámetro.
 */
const plantillaGuardar = [
  body('plantilla').optional().isString().withMessage('El mensaje debe ser texto.'),
  body('imagen').optional({ values: 'null' }).isString()
    .withMessage('La imagen debe enviarse como texto en base64.'),
  body().custom((cuerpo) => {
    if (cuerpo.plantilla === undefined && cuerpo.imagen === undefined) {
      throw new Error('No se indicó ningún cambio.');
    }
    return true;
  }),
  validar,
];

const plantillaPrevisualizar = [
  body('plantilla').isString().withMessage('El mensaje debe ser texto.'),
  validar,
];

/**
 * Borrado definitivo: además del identificador, la contraseña de quien lo pide.
 * Que coincida lo comprueba `auth.service`; aquí solo se exige que venga.
 */
const citaEliminar = [
  reglaId,
  body('contrasena').isString().notEmpty()
    .withMessage('Escriba su contraseña para confirmar el borrado.'),
  validar,
];

const soloId = [reglaId, validar];

const soloCitaId = [
  param('citaId').isInt({ min: 1 }).withMessage('El identificador de la cita no es válido.'),
  validar,
];

module.exports = {
  examenCrear,
  examenActualizar,
  ordenCrear,
  ordenActualizar,
  ordenVencimiento,
  citaCrear,
  citaRecepcion,
  citaActualizar,
  citaEstado,
  citaDisponibilidad,
  citaSugerencias,
  agendaVista,
  citaEliminar,
  configuracionActualizar,
  plantillaGuardar,
  plantillaPrevisualizar,
  soloId,
  soloCitaId,
};
