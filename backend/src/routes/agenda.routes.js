const { Router } = require('express');

const agendaController = require('../controllers/agenda.controller');
const { autenticar, autorizar } = require('../middleware/auth');
const { ROLES } = require('../utils/roles');
const { agendaVista, configuracionActualizar } = require('../validators/agenda.validator');

const router = Router();

router.use(autenticar);

router.get('/', agendaVista, agendaController.obtenerVista);
router.get('/resumen', agendaController.obtenerResumen);
router.get('/configuracion', agendaController.obtenerConfiguracion);

// El límite diario y el horario solo los cambia el administrador (requisito 14).
router.patch(
  '/configuracion',
  autorizar(ROLES.ADMINISTRADOR),
  configuracionActualizar,
  agendaController.actualizarConfiguracion,
);

module.exports = router;
