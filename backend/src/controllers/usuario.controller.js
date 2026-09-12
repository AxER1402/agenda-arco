const usuarioService = require('../services/usuario.service');

/** GET /api/usuarios */
async function listar(req, res, next) {
  try {
    const incluirInactivos = req.query.incluirInactivos === 'true';
    res.status(200).json(await usuarioService.listar({ incluirInactivos }));
  } catch (error) {
    next(error);
  }
}

/** GET /api/usuarios/:id */
async function obtener(req, res, next) {
  try {
    res.status(200).json(await usuarioService.obtener(req.params.id));
  } catch (error) {
    next(error);
  }
}

/** POST /api/usuarios */
async function crear(req, res, next) {
  try {
    const creado = await usuarioService.crear(req.body);
    res.status(201).json(creado);
  } catch (error) {
    next(error);
  }
}

/** PATCH /api/usuarios/:id */
async function actualizar(req, res, next) {
  try {
    res.status(200).json(await usuarioService.actualizar(req.params.id, req.body));
  } catch (error) {
    next(error);
  }
}

/** DELETE /api/usuarios/:id — baja lógica. */
async function desactivar(req, res, next) {
  try {
    res.status(200).json(await usuarioService.desactivar(req.params.id, req.usuario.id));
  } catch (error) {
    next(error);
  }
}

/** DELETE /api/usuarios/:id/definitivo — borrado sin vuelta atrás. */
async function eliminar(req, res, next) {
  try {
    const resultado = await usuarioService.eliminar(req.params.id, {
      idUsuarioSolicitante: req.usuario.id,
      contrasena: req.body.contrasena,
    });
    res.status(200).json(resultado);
  } catch (error) {
    next(error);
  }
}

/** PATCH /api/usuarios/:id/contrasena */
async function restablecerContrasena(req, res, next) {
  try {
    const resultado = await usuarioService.restablecerContrasena(
      req.params.id,
      req.body.contrasenaNueva,
    );
    res.status(200).json(resultado);
  } catch (error) {
    next(error);
  }
}

/** GET /api/usuarios/roles */
async function listarRoles(req, res, next) {
  try {
    res.status(200).json(await usuarioService.listarRoles());
  } catch (error) {
    next(error);
  }
}

module.exports = {
  listar,
  obtener,
  crear,
  actualizar,
  desactivar,
  eliminar,
  restablecerContrasena,
  listarRoles,
};
