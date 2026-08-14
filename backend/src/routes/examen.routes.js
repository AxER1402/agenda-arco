const { Router } = require('express');

const examenController = require('../controllers/examen.controller');
const { autenticar, autorizar } = require('../middleware/auth');
const { ROLES } = require('../utils/roles');
const { examenCrear, examenActualizar, soloId } = require('../validators/agenda.validator');

const router = Router();

router.use(autenticar);

// Consultar y dar de alta exámenes lo necesita todo el personal: si llega un
// paciente con un examen que no está en el catálogo, quien lo recibe tiene que
// poder agregarlo sin trabar la atención. Modificar y desactivar el catálogo ya
// existente sigue siendo del administrador.
router.get('/', examenController.listar);
router.get('/:id', soloId, examenController.obtener);

router.post('/', examenCrear, examenController.crear);
router.patch('/:id', autorizar(ROLES.ADMINISTRADOR), examenActualizar, examenController.actualizar);
router.delete('/:id', autorizar(ROLES.ADMINISTRADOR), soloId, examenController.desactivar);

module.exports = router;
