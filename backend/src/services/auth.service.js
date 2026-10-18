/**
 * Reglas de autenticación.
 * Los controladores no deciden nada: todo ocurre aquí.
 */
const env = require('../config/env');
const usuarioModel = require('../models/usuario.model');
const password = require('../utils/password');
const jwt = require('../utils/jwt');
const google = require('../utils/google');
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

  return abrirSesion(fila);
}

/** Lo mismo para cualquier forma de entrar: anota el acceso y firma el token. */
async function abrirSesion(fila) {
  await usuarioModel.registrarAcceso(fila.id);

  const token = jwt.firmar({ id: fila.id, usuario: fila.usuario, rol: fila.rol });

  return { token, usuario: aUsuarioPublico(fila) };
}

/**
 * Lo que necesita la pantalla de acceso para pintar el botón de Google.
 * El identificador de cliente no es secreto: Google lo enseña en cada botón.
 */
function configuracionGoogle() {
  const { clientId } = env.google;
  return { habilitado: Boolean(clientId), clientId: clientId || null };
}

/**
 * Entrada con «Continuar con Google».
 *
 * Google solo dice quién es la persona; quién puede entrar lo sigue decidiendo
 * el administrador. Por eso no se crean cuentas al vuelo: el correo tiene que
 * estar anotado de antemano en un usuario activo. Si no, se rechaza con el
 * mismo mensaje tanto si no hay usuario como si está desactivado.
 */
async function loginConGoogle({ credencial }) {
  if (!env.google.clientId) {
    throw AppError.notFound('El acceso con Google no está habilitado.');
  }

  let identidad;
  try {
    identidad = await google.verificarCredencial(credencial);
  } catch {
    throw AppError.unauthorized('No se pudo verificar la cuenta de Google. Intente de nuevo.');
  }

  // Un correo sin verificar podría ser de cualquiera: Google no garantiza que
  // quien inició sesión sea el dueño del buzón.
  if (!identidad.correo || !identidad.correoVerificado) {
    throw AppError.unauthorized('La cuenta de Google no tiene un correo verificado.');
  }

  const fila = await usuarioModel.buscarPorCorreo(identidad.correo);

  if (!fila || !fila.activo) {
    throw AppError.unauthorized(
      'Esta cuenta de Google no tiene acceso al sistema. Pida al administrador que la vincule a su usuario.',
    );
  }

  // La foto se refresca en cada entrada: si la persona la cambia en Google,
  // aquí aparece la nueva sin que nadie toque nada.
  const foto = identidad.foto ?? null;
  if (foto !== (fila.foto_url ?? null)) {
    await usuarioModel.actualizar(fila.id, { fotoUrl: foto });
  }

  return abrirSesion({ ...fila, foto_url: foto });
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
  loginConGoogle,
  configuracionGoogle,
  obtenerPerfil,
  confirmarIdentidad,
  cambiarContrasenaPropia,
  aUsuarioPublico,
};
