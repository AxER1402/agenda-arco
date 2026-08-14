const { Router } = require('express');

const citaController = require('../controllers/cita.controller');
const { autenticar } = require('../middleware/auth');
const {
  citaCrear,
  citaRecepcion,
  citaActualizar,
  citaEstado,
  citaDisponibilidad,
  citaSugerencias,
  citaEliminar,
  soloId,
} = require('../validators/agenda.validator');

const router = Router();

router.use(autenticar);

// Rutas fijas antes de '/:id'.
router.get('/estados', citaController.listarEstados);
router.get('/disponibilidad', citaDisponibilidad, citaController.disponibilidad);
router.get('/sugerencias', citaSugerencias, citaController.sugerencias);
router.get('/paciente/:pacienteId', citaController.historial);

router.post('/', citaCrear, citaController.crear);
// Recepción en el mostrador: registra paciente y orden junto con la cita.
router.post('/recepcion', citaRecepcion, citaController.recibir);
router.get('/:id', soloId, citaController.obtener);
router.patch('/:id', citaActualizar, citaController.actualizar);
router.patch('/:id/estado', citaEstado, citaController.cambiarEstado);
// Borrado definitivo: pide la contraseña de la sesión (va en el cuerpo).
router.delete('/:id', citaEliminar, citaController.eliminar);

module.exports = router;
