const { Router } = require('express');

const reporteController = require('../controllers/reporte.controller');
const { autenticar } = require('../middleware/auth');
const { reporteCitas, reporteActividad } = require('../validators/reporte.validator');

const router = Router();

// Los dos reportes son trabajo de mostrador tanto como de dirección: la hoja de
// citas la imprime quien atiende, y el resumen sale de los mismos datos que ya
// se ven en el panel. No hace falta ser administrador.
router.use(autenticar);

router.get('/citas', reporteCitas, reporteController.citas);
router.get('/actividad', reporteActividad, reporteController.actividad);

module.exports = router;
