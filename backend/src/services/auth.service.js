/**
 * Reglas de autenticación.
 * Los controladores no deciden nada: todo ocurre aquí.
 */
const usuarioModel = require('../models/usuario.model');
const password = require('../utils/password');
const jwt = require('../utils/jwt');
const AppError = require('../utils/AppError');

/** Quita el hash antes de devolver el usuario hacia afuera. */
function aUsuarioPublico(fila) {
  if (!fila) return null;
  const { password_hash: _hash, ...publico } = fila;
  return publico;
}

/**
 * Valida credenciales y devuelve el token de sesión.
 *
 * Seguridad: se responde el mismo mensaje si el usuario no existe, si la
 * contraseña es incorrecta o si la cuenta está inactiva. Distinguirlos
 * permitiría averiguar qué usuarios existen.
 */
async function login({ usuario, contrasena }) {
  const fila = await usuarioModel.buscarPorUsuarioConPassword(usuario);
  const credencialesInvalidas = AppError.unauthorized('Usuario o contraseña incorrectos.');

  if (!fila) {
    // Se compara igualmente contra un hash ficticio para que el tiempo de
    // respuesta no delate si el usuario existe.
    await password.verificar(contrasena, '$2b$10$invalidinvalidinvalidinvalidinvalidinvalidinvalidinv');
    throw credencialesInvalidas;
  }

  const coincide = await password.verificar(contrasena, fila.password_hash);
  if (!coincide || !fila.activo) {
    throw credencialesInvalidas;
  }

  await usuarioModel.registrarAcceso(fila.id);

  const token = jwt.firmar({ id: fila.id, usuario: fila.usuario, rol: fila.rol });

  return { token, usuario: aUsuarioPublico(fila) };
}

/** Datos del usuario autenticado (para /api/auth/perfil). */
async function obtenerPerfil(idUsuario) {
  const usuario = await usuarioModel.buscarPorId(idUsuario);

  if (!usuario || !usuario.activo) {
    throw AppError.unauthorized('La sesión ya no es válida.');
  }

  return usuario;
}

/**
 * Comprueba que quien pide algo es de verdad el dueño de la sesión.
 *
 * Se usa antes de las acciones que no se pueden deshacer: un token robado, o un
 * equipo que alguien dejó abierto en el mostrador, no basta para borrar nada.
 *
 * @throws {AppError} 401 si la contraseña no coincide o la cuenta ya no vale.
 */
async function confirmarIdentidad(idUsuario, contrasena) {
  const usuario = await usuarioModel.buscarPorId(idUsuario);

  if (!usuario || !usuario.activo) {
    throw AppError.unauthorized('La sesión ya no es válida.');
  }

  const conPassword = await usuarioModel.buscarPorUsuarioConPassword(usuario.usuario);
  const coincide = await password.verificar(contrasena ?? '', conPassword.password_hash);

  if (!coincide) {
    throw AppError.unauthorized('La contraseña no es correcta.');
  }

  return true;
}

/** Cambio de contraseña del propio usuario autenticado. */
async function cambiarContrasenaPropia(idUsuario, { contrasenaActual, contrasenaNueva }) {
  const usuario = await usuarioModel.buscarPorId(idUsuario);
  if (!usuario) throw AppError.notFound('Usuario no encontrado.');

  const conPassword = await usuarioModel.buscarPorUsuarioConPassword(usuario.usuario);
  const coincide = await password.verificar(contrasenaActual, conPassword.password_hash);

  if (!coincide) {
    throw AppError.badRequest('La contraseña actual no es correcta.');
  }

  await usuarioModel.actualizar(idUsuario, {
    passwordHash: await password.hashear(contrasenaNueva),
  });

  return { mensaje: 'Contraseña actualizada.' };
}

module.exports = {
  login,
  obtenerPerfil,
  confirmarIdentidad,
  cambiarContrasenaPropia,
  aUsuarioPublico,
};
