const { Router } = require('express');

const examenController = require('../controllers/examen.controller');
const { autenticar } = require('../middleware/auth');
const { examenCrear, examenActualizar, soloId } = require('../validators/agenda.validator');

const router = Router();

router.use(autenticar);

// El catálogo lo mantiene todo el personal: quien recibe al paciente es quien
// se encuentra con un examen que falta, un nombre mal escrito o uno que ya no
// se hace, y tiene que poder corregirlo sin esperar al administrador.
//
// La desactivación va por PATCH (`activo: false`); DELETE borra de verdad, y
// solo deja hacerlo con exámenes que ninguna cita ni orden usa.
router.get('/', examenController.listar);
router.get('/:id', soloId, examenController.obtener);

router.post('/', examenCrear, examenController.crear);
router.patch('/:id', examenActualizar, examenController.actualizar);
router.delete('/:id', soloId, examenController.eliminar);

module.exports = router;
