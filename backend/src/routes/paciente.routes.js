const { Router } = require('express');

const pacienteController = require('../controllers/paciente.controller');
const { autenticar, autorizar } = require('../middleware/auth');
const { ROLES } = require('../utils/roles');
const {
  reglasCrear,
  reglasActualizar,
  reglasBuscar,
  reglasObtener,
  reglasPorTelefono,
  reglasEliminar,
} = require('../validators/paciente.validator');

const router = Router();

// Ambos roles gestionan pacientes; la baja lógica queda para el administrador.
router.use(autenticar);

router.get('/', reglasBuscar, pacienteController.buscar);
// Ruta fija antes de '/:id' para que no la capture el parámetro.
router.get('/telefono/:telefono', reglasPorTelefono, pacienteController.porTelefono);
router.post('/', reglasCrear, pacienteController.crear);
router.get('/:id', reglasObtener, pacienteController.obtener);
router.patch('/:id', reglasActualizar, pacienteController.actualizar);
router.delete('/:id', autorizar(ROLES.ADMINISTRADOR), reglasObtener, pacienteController.desactivar);
// Borrado definitivo, con su historial. Pide la contraseña de la sesión.
router.delete(
  '/:id/definitivo',
  autorizar(ROLES.ADMINISTRADOR),
  reglasEliminar,
  pacienteController.eliminar,
);
router.post(
  '/:id/reactivar',
  autorizar(ROLES.ADMINISTRADOR),
  reglasObtener,
  pacienteController.reactivar,
);

module.exports = router;
