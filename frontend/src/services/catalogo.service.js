import api from './api';

// --- Exámenes --------------------------------------------------------------

export async function listarExamenes({ termino = '', incluirInactivos = false } = {}) {
  const { data } = await api.get('/examenes', { params: { termino, incluirInactivos } });
  return data;
}

export async function crearExamen(examen) {
  const { data } = await api.post('/examenes', examen);
  return data;
}

export async function actualizarExamen(id, cambios) {
  const { data } = await api.patch(`/examenes/${id}`, cambios);
  return data;
}

export async function desactivarExamen(id) {
  const { data } = await api.delete(`/examenes/${id}`);
  return data;
}

// --- Órdenes del IGSS ------------------------------------------------------

export async function listarOrdenesDePaciente(pacienteId) {
  const { data } = await api.get('/ordenes', { params: { pacienteId } });
  return data;
}

export async function listarOrdenesPorVencer(dias = 30) {
  const { data } = await api.get('/ordenes/por-vencer', { params: { dias } });
  return data;
}

/**
 * Consulta al backend el vencimiento de una orden recibida en esa fecha, junto
 * con las fechas con cupo más cercanas a él.
 *
 * El cálculo no se replica aquí: la regla de los tres meses vive en un solo
 * lugar (requisito 12).
 */
export async function calcularVencimiento(fechaEntrega) {
  const { data } = await api.get('/ordenes/vencimiento', { params: { fechaEntrega } });
  return data;
}

// --- Configuración ---------------------------------------------------------

export async function obtenerConfiguracion() {
  const { data } = await api.get('/agenda/configuracion');
  return data;
}

export async function actualizarConfiguracion(cambios) {
  const { data } = await api.patch('/agenda/configuracion', cambios);
  return data;
}
