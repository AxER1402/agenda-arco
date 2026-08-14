import api from './api';

export async function crearCita(cita) {
  const { data } = await api.post('/citas', cita);
  return data;
}

/**
 * Recepción en el mostrador: registra al paciente (si es nuevo), su orden del
 * IGSS y la cita en una sola llamada.
 */
export async function recibirPaciente(datos) {
  const { data } = await api.post('/citas/recepcion', datos);
  return data;
}

export async function obtenerCita(id) {
  const { data } = await api.get(`/citas/${id}`);
  return data;
}

export async function actualizarCita(id, cambios) {
  const { data } = await api.patch(`/citas/${id}`, cambios);
  return data;
}

export async function cambiarEstadoCita(id, estado, motivo) {
  const { data } = await api.patch(`/citas/${id}/estado`, { estado, motivo });
  return data;
}

/** Cancelar conserva la cita en el historial; solo cambia su estado. */
export async function cancelarCita(id, motivo) {
  return cambiarEstadoCita(id, 'CANCELADA', motivo);
}

/**
 * Borrado definitivo: para las citas creadas por error.
 *
 * Pide la contraseña de quien tiene la sesión abierta, porque no se puede
 * deshacer. Viaja en el cuerpo de la petición, no en la URL, para que no acabe
 * escrita en los registros del servidor.
 */
export async function eliminarCita(id, contrasena) {
  const { data } = await api.delete(`/citas/${id}`, { data: { contrasena } });
  return data;
}

export async function consultarDisponibilidad(fecha) {
  const { data } = await api.get('/citas/disponibilidad', { params: { fecha } });
  return data;
}

export async function listarEstadosCita() {
  const { data } = await api.get('/citas/estados');
  return data;
}

// --- Agenda ----------------------------------------------------------------

export async function obtenerAgenda({ vista = 'dia', fecha, incluirCanceladas = false }) {
  const { data } = await api.get('/agenda', { params: { vista, fecha, incluirCanceladas } });
  return data;
}

export async function obtenerResumen() {
  const { data } = await api.get('/agenda/resumen');
  return data;
}
