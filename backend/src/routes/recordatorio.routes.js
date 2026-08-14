const { Router } = require('express');

const recordatorioController = require('../controllers/recordatorio.controller');
const { autenticar, autorizar } = require('../middleware/auth');
const { ROLES } = require('../utils/roles');
const {
  soloId,
  soloCitaId,
  plantillaGuardar,
  plantillaPrevisualizar,
} = require('../validators/agenda.validator');

const router = Router();

router.use(autenticar);

router.get('/', recordatorioController.listar);
router.get('/resumen', recordatorioController.resumen);
router.get('/whatsapp/estado', recordatorioController.estadoWhatsapp);

// Vincular la cuenta de WhatsApp del laboratorio es una acción administrativa.
router.get('/whatsapp/qr', autorizar(ROLES.ADMINISTRADOR), recordatorioController.qrWhatsapp);
router.post(
  '/whatsapp/desvincular',
  autorizar(ROLES.ADMINISTRADOR),
  recordatorioController.desvincularWhatsapp,
);

// Qué se le manda al paciente. Cualquiera puede consultarlo; redactarlo, no.
router.get('/plantilla', recordatorioController.obtenerPlantilla);
router.post(
  '/plantilla/previsualizar',
  plantillaPrevisualizar,
  recordatorioController.previsualizarPlantilla,
);
router.put(
  '/plantilla',
  autorizar(ROLES.ADMINISTRADOR),
  plantillaGuardar,
  recordatorioController.guardarPlantilla,
);

router.post('/preparar', recordatorioController.preparar);
router.post('/enviar', recordatorioController.enviarPendientes);
// Ruta fija antes de '/:id' para que no la capture el parámetro.
router.post('/cita/:citaId', soloCitaId, recordatorioController.enviarParaCita);
router.post('/:id/reintentar', soloId, recordatorioController.reintentar);

module.exports = router;
