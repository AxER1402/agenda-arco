const { Router } = require('express');

const categoriaController = require('../controllers/categoria.controller');
const { autenticar } = require('../middleware/auth');
const {
  categoriaCrear,
  categoriaActualizar,
  soloId,
} = require('../validators/agenda.validator');

const router = Router();

router.use(autenticar);

// Como el catálogo de exámenes, las categorías las mantiene todo el personal.
router.get('/', categoriaController.listar);
router.post('/', categoriaCrear, categoriaController.crear);
router.patch('/:id', categoriaActualizar, categoriaController.actualizar);
router.delete('/:id', soloId, categoriaController.eliminar);

module.exports = router;
