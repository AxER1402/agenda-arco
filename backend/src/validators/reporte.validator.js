/**
 * Validadores de los reportes.
 * El rango se comprueba también en `reporte.service` —es una regla de negocio,
 * no de transporte—; aquí solo se mira la forma de la petición.
 */
const { query } = require('express-validator');
const { validar } = require('./validar');
const { esFechaValida } = require('../utils/fechas');
const { ESTADOS } = require('../services/cita.service');

const FORMATOS = ['pdf', 'docx'];

const CODIGOS_ESTADO = Object.values(ESTADOS);

const reglaFecha = (campo, nombre) =>
  query(campo).custom(esFechaValida).withMessage(`${nombre} debe tener el formato AAAA-MM-DD.`);

const reglaFormato = query('formato')
  .optional()
  .isIn(FORMATOS)
  .withMessage(`El formato debe ser uno de: ${FORMATOS.join(', ')}.`);

const reporteCitas = [
  reglaFecha('desde', 'La fecha inicial'),
  reglaFecha('hasta', 'La fecha final'),
  query('estado')
    .optional({ values: 'falsy' })
    .isIn(CODIGOS_ESTADO)
    .withMessage(`El estado debe ser uno de: ${CODIGOS_ESTADO.join(', ')}.`),
  reglaFormato,
  validar,
];

const reporteActividad = [
  reglaFecha('desde', 'La fecha inicial'),
  reglaFecha('hasta', 'La fecha final'),
  reglaFormato,
  validar,
];

module.exports = { FORMATOS, reporteCitas, reporteActividad };
