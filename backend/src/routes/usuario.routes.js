const { Router } = require('express');

const usuarioController = require('../controllers/usuario.controller');
const { autenticar, autorizar } = require('../middleware/auth');
const { ROLES } = require('../utils/roles');
const {
  reglasCrear,
  reglasActualizar,
  reglasRestablecerContrasena,
  reglasObtener,
} = require('../validators/usuario.validator');

const router = Router();

// Toda la administración de usuarios es exclusiva del administrador.
router.use(autenticar, autorizar(ROLES.ADMINISTRADOR));

// Antes de '/:id' para que "roles" no se interprete como un identificador.
router.get('/roles', usuarioController.listarRoles);

router.get('/', usuarioController.listar);
router.post('/', reglasCrear, usuarioController.crear);
router.get('/:id', reglasObtener, usuarioController.obtener);
router.patch('/:id', reglasActualizar, usuarioController.actualizar);
router.delete('/:id', reglasObtener, usuarioController.desactivar);
router.patch(
  '/:id/contrasena',
  reglasRestablecerContrasena,
  usuarioController.restablecerContrasena,
);

module.exports = router;
