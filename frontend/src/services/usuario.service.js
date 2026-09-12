import api from './api';

export async function listarUsuarios(incluirInactivos = false) {
  const { data } = await api.get('/usuarios', { params: { incluirInactivos } });
  return data;
}

export async function listarRoles() {
  const { data } = await api.get('/usuarios/roles');
  return data;
}

export async function crearUsuario(usuario) {
  const { data } = await api.post('/usuarios', usuario);
  return data;
}

export async function actualizarUsuario(id, cambios) {
  const { data } = await api.patch(`/usuarios/${id}`, cambios);
  return data;
}

export async function desactivarUsuario(id) {
  const { data } = await api.delete(`/usuarios/${id}`);
  return data;
}

/** Borrado definitivo. Pide la contraseña de quien tiene la sesión abierta. */
export async function eliminarUsuario(id, contrasena) {
  const { data } = await api.delete(`/usuarios/${id}/definitivo`, { data: { contrasena } });
  return data;
}

export async function restablecerContrasena(id, contrasenaNueva) {
  const { data } = await api.patch(`/usuarios/${id}/contrasena`, { contrasenaNueva });
  return data;
}
