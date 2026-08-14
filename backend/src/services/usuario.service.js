/**
 * Reglas de negocio de la administración de usuarios.
 * Solo el rol ADMINISTRADOR llega hasta aquí (lo garantiza el middleware).
 */
const usuarioModel = require('../models/usuario.model');
const password = require('../utils/password');
const AppError = require('../utils/AppError');
const { ROLES } = require('../utils/roles');

async function listar({ incluirInactivos = false } = {}) {
  return usuarioModel.listar({ incluirInactivos });
}

async function obtener(id) {
  const usuario = await usuarioModel.buscarPorId(id);
  if (!usuario) throw AppError.notFound('El usuario no existe.');
  return usuario;
}

async function resolverRol(codigoRol) {
  const rol = await usuarioModel.buscarRolPorCodigo(codigoRol);
  if (!rol) throw AppError.badRequest(`El rol "${codigoRol}" no existe.`);
  return rol;
}

async function crear({ nombreCompleto, usuario, contrasena, rol }) {
  if (await usuarioModel.existeUsuario(usuario)) {
    throw AppError.conflict('Ya existe un usuario con ese nombre de acceso.');
  }

  const rolEncontrado = await resolverRol(rol);

  return usuarioModel.crear({
    nombreCompleto,
    usuario,
    passwordHash: await password.hashear(contrasena),
    rolId: rolEncontrado.id,
  });
}

async function actualizar(id, { nombreCompleto, usuario, rol, activo }) {
  const existente = await obtener(id);

  if (usuario && (await usuarioModel.existeUsuario(usuario, id))) {
    throw AppError.conflict('Ya existe otro usuario con ese nombre de acceso.');
  }

  const cambios = { nombreCompleto, usuario, activo };

  if (rol) {
    cambios.rolId = (await resolverRol(rol)).id;
  }

  // No se puede quedar el sistema sin ningún administrador activo.
  const dejaDeSerAdmin =
    existente.rol === ROLES.ADMINISTRADOR &&
    ((rol && rol !== ROLES.ADMINISTRADOR) || activo === false);

  if (dejaDeSerAdmin && (await usuarioModel.contarAdministradoresActivos()) <= 1) {
    throw AppError.conflict(
      'No se puede modificar al único administrador activo del sistema.',
    );
  }

  return usuarioModel.actualizar(id, cambios);
}

/**
 * Baja lógica. No se borra el registro porque las órdenes y las citas guardan
 * qué usuario las creó y ese historial debe conservarse.
 */
async function desactivar(id, idUsuarioSolicitante) {
  if (Number(id) === Number(idUsuarioSolicitante)) {
    throw AppError.badRequest('No puede desactivar su propio usuario.');
  }

  return actualizar(id, { activo: false });
}

/** Restablecimiento de contraseña por parte de un administrador. */
async function restablecerContrasena(id, contrasenaNueva) {
  await obtener(id);

  await usuarioModel.actualizar(id, {
    passwordHash: await password.hashear(contrasenaNueva),
  });

  return { mensaje: 'Contraseña restablecida.' };
}

async function listarRoles() {
  return usuarioModel.listarRoles();
}

module.exports = {
  listar,
  obtener,
  crear,
  actualizar,
  desactivar,
  restablecerContrasena,
  listarRoles,
};
