const authService = require('../services/auth.service');

/** POST /api/auth/login */
async function login(req, res, next) {
  try {
    const { usuario, contrasena } = req.body;
    const resultado = await authService.login({ usuario, contrasena });
    res.status(200).json(resultado);
  } catch (error) {
    next(error);
  }
}

/** GET /api/auth/perfil */
async function perfil(req, res, next) {
  try {
    res.status(200).json(await authService.obtenerPerfil(req.usuario.id));
  } catch (error) {
    next(error);
  }
}

/** PATCH /api/auth/contrasena */
async function cambiarContrasena(req, res, next) {
  try {
    const { contrasenaActual, contrasenaNueva } = req.body;
    const resultado = await authService.cambiarContrasenaPropia(req.usuario.id, {
      contrasenaActual,
      contrasenaNueva,
    });
    res.status(200).json(resultado);
  } catch (error) {
    next(error);
  }
}

module.exports = { login, perfil, cambiarContrasena };
