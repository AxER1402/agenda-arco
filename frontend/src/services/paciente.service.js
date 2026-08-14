import api from './api';

export async function buscarPacientes({ termino = '', pagina = 1, porPagina = 20, incluirInactivos = false } = {}) {
  const { data } = await api.get('/pacientes', {
    params: { termino, pagina, porPagina, incluirInactivos },
  });
  return data;
}

/**
 * Pacientes registrados con ese número.
 * Pueden ser varios: los familiares comparten teléfono.
 */
export async function buscarPorTelefono(telefono) {
  const { data } = await api.get(`/pacientes/telefono/${telefono}`);
  return data;
}

export async function obtenerPaciente(id) {
  const { data } = await api.get(`/pacientes/${id}`);
  return data;
}

export async function crearPaciente(paciente) {
  const { data } = await api.post('/pacientes', paciente);
  return data;
}

export async function actualizarPaciente(id, cambios) {
  const { data } = await api.patch(`/pacientes/${id}`, cambios);
  return data;
}

export async function desactivarPaciente(id) {
  const { data } = await api.delete(`/pacientes/${id}`);
  return data;
}

export async function historialDePaciente(id) {
  const { data } = await api.get(`/citas/paciente/${id}`);
  return data;
}
