const { Router } = require('express');

const ordenController = require('../controllers/orden.controller');
const { autenticar } = require('../middleware/auth');
const {
  ordenCrear,
  ordenActualizar,
  ordenVencimiento,
  soloId,
} = require('../validators/agenda.validator');

const router = Router();

router.use(autenticar);

// Antes de '/:id' para que no se interpreten como identificadores.
router.get('/vencimiento', ordenVencimiento, ordenController.calcularVencimiento);
router.get('/por-vencer', ordenController.listarPorVencer);

router.get('/', ordenController.listar);
router.post('/', ordenCrear, ordenController.crear);
router.get('/:id', soloId, ordenController.obtener);
router.patch('/:id', ordenActualizar, ordenController.actualizar);

module.exports = router;
