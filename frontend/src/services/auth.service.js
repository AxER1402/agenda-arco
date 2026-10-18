import api from './api';

const CLAVE_TOKEN = 'arco_token';

/** El token se guarda en localStorage; el interceptor de api.js lo adjunta. */
export function guardarToken(token) {
  localStorage.setItem(CLAVE_TOKEN, token);
}

export function obtenerToken() {
  return localStorage.getItem(CLAVE_TOKEN);
}

export function borrarToken() {
  localStorage.removeItem(CLAVE_TOKEN);
}

/** POST /api/auth/login */
export async function iniciarSesion({ usuario, contrasena }) {
  const { data } = await api.post('/auth/login', { usuario, contrasena });
  guardarToken(data.token);
  return data.usuario;
}

/**
 * GET /api/auth/google — si se ofrece «Continuar con Google» y con qué cliente.
 * El identificador lo da el backend para que haya un único sitio que configurar.
 */
export async function obtenerConfigGoogle() {
  const { data } = await api.get('/auth/google');
  return data;
}

/** POST /api/auth/google — cambia la credencial de Google por la sesión propia. */
export async function iniciarSesionConGoogle(credencial) {
  const { data } = await api.post('/auth/google', { credencial });
  guardarToken(data.token);
  return data.usuario;
}

/** GET /api/auth/perfil — sirve también para validar el token guardado. */
export async function obtenerPerfil() {
  const { data } = await api.get('/auth/perfil');
  return data;
}

/** PATCH /api/auth/contrasena */
export async function cambiarContrasena({ contrasenaActual, contrasenaNueva }) {
  const { data } = await api.patch('/auth/contrasena', { contrasenaActual, contrasenaNueva });
  return data;
}

export function cerrarSesion() {
  borrarToken();
}
